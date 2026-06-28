import { type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AssistantPanel } from './components/AssistantPanel';
import { DiagramCanvas } from './components/DiagramCanvas';
import { captureAnalyticsEvent } from './lib/analytics';
import { meaningfulSceneSignature } from './lib/diagramSummary';
import { useLlmReviewContext } from './hooks/useLlmReviewContext';
import { llmProviderFactory } from './lib/llm/provider';
import { appStorage } from './lib/storage';
import type { AppSettings, ChatMessage, DiagramSnapshot, ExcalidrawApi } from './types';
import './styles.css';

const AUTO_REVIEW_INTERVAL_MS = 20_000;
const AUTO_REVIEW_MAX_WAIT_MS = 60_000;
const MIN_ELEMENTS_FOR_PROACTIVE_REVIEW = 2;
const DEFAULT_SIDEBAR_WIDTH = 420;
const MIN_SIDEBAR_WIDTH = 320;
const MAX_SIDEBAR_WIDTH = 720;
const MIN_CANVAS_WIDTH = 420;

function clampSidebarWidth(width: number) {
  const viewportLimit = typeof window === 'undefined' ? MAX_SIDEBAR_WIDTH : Math.max(MIN_SIDEBAR_WIDTH, window.innerWidth - MIN_CANVAS_WIDTH);
  return Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), Math.min(MAX_SIDEBAR_WIDTH, viewportLimit));
}

function loadSidebarWidth() {
  return clampSidebarWidth(appStorage.loadSidebarWidth(DEFAULT_SIDEBAR_WIDTH));
}

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function settingsValidationKey(settings: AppSettings) {
  return [settings.provider, settings.endpoint, settings.model, settings.apiKey, settings.temperature, settings.thinkingLevel].join('\u001f');
}

export default function App() {
  const initialSnapshot = useMemo(() => appStorage.loadScene(), []);
  const [settings, setSettings] = useState<AppSettings>(() => appStorage.loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>(() => appStorage.loadChat());
  const [sidebarWidth, setSidebarWidth] = useState(loadSidebarWidth);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState(() => llmProviderFactory.getProviderStatus(settings));
  const [modelValidationError, setModelValidationError] = useState<{ key: string; message: string } | null>(null);

  const apiRef = useRef<ExcalidrawApi | null>(null);
  const snapshotRef = useRef<DiagramSnapshot | null>(initialSnapshot);
  const persistTimerRef = useRef<number | undefined>(undefined);
  const proactiveTimerRef = useRef<number | undefined>(undefined);
  const firstUnsentChangeAtRef = useRef<number | null>(null);
  const lastSentSignatureRef = useRef('');
  const lastReviewSignatureRef = useRef('');
  const isBusyRef = useRef(false);
  const inFlightAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    appStorage.saveSettings(settings);
    setStatus(llmProviderFactory.getProviderStatus(settings));
  }, [settings]);

  useEffect(() => {
    appStorage.saveChat(messages);
  }, [messages]);

  useEffect(() => {
    const nextWidth = clampSidebarWidth(sidebarWidth);
    if (nextWidth !== sidebarWidth) {
      setSidebarWidth(nextWidth);
      return;
    }
    appStorage.saveSidebarWidth(nextWidth);
  }, [sidebarWidth]);

  useEffect(() => {
    const handleWindowResize = () => setSidebarWidth((width) => clampSidebarWidth(width));
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  const getCurrentSnapshot = useCallback(() => snapshotRef.current, []);
  const buildLlmReviewMessages = useLlmReviewContext({ settings, messages, getSnapshot: getCurrentSnapshot });

  const handleSettingsChange = useCallback((nextSettings: AppSettings) => {
    setSettings(llmProviderFactory.withActiveConfiguration(nextSettings));
  }, []);

  const updateMessages = (updater: (messages: ChatMessage[]) => ChatMessage[]) => {
    setMessages((current) => updater(current));
  };

  const appendMessage = (message: ChatMessage) => {
    updateMessages((current) => [...current, message]);
  };

  const appendToken = (messageId: string, token: string) => {
    updateMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, content: message.content + token } : message,
      ),
    );
  };

  const scheduleProactiveReview = () => {
    window.clearTimeout(proactiveTimerRef.current);
    if (!settings.autoReview) {
      firstUnsentChangeAtRef.current = null;
      return;
    }

    const current = snapshotRef.current;
    if (!current) return;

    const signature = meaningfulSceneSignature(current);
    if (!signature || signature === lastSentSignatureRef.current) {
      firstUnsentChangeAtRef.current = null;
      return;
    }

    const now = Date.now();
    firstUnsentChangeAtRef.current ??= now;
    const maxWaitRemaining = AUTO_REVIEW_MAX_WAIT_MS - (now - firstUnsentChangeAtRef.current);
    const delay = Math.max(0, Math.min(AUTO_REVIEW_INTERVAL_MS, maxWaitRemaining));

    proactiveTimerRef.current = window.setTimeout(() => {
      if (isBusyRef.current) {
        proactiveTimerRef.current = window.setTimeout(scheduleProactiveReview, AUTO_REVIEW_INTERVAL_MS);
        return;
      }
      void runAgentReview({ mode: 'proactive' });
    }, delay);
  };

  const handleSnapshotChange = (nextSnapshot: DiagramSnapshot) => {
    // Keep high-frequency canvas changes out of React state. Excalidraw calls
    // onChange often; setting parent state here can cause Excalidraw to
    // re-render/reinitialize in a loop.
    snapshotRef.current = nextSnapshot;

    window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => appStorage.saveScene(nextSnapshot), 600);

    scheduleProactiveReview();
  };

  const runAgentReview = async ({ mode, prompt }: { mode: 'manual' | 'proactive' | 'chat'; prompt?: string }) => {
    if (isBusy) return;
    const current = snapshotRef.current;
    if (!current) {
      appendMessage({ id: id('err'), role: 'assistant', content: 'Draw a diagram first, then ask me to review it.', createdAt: Date.now(), kind: 'status' });
      return;
    }

    const liveElements = current.elements.filter((element) => !element.isDeleted);
    const currentSignature = meaningfulSceneSignature(current);
    const designChangedSincePreviousReview = mode === 'proactive' && Boolean(lastReviewSignatureRef.current) && currentSignature !== lastReviewSignatureRef.current;
    if (mode === 'proactive' && liveElements.length < MIN_ELEMENTS_FOR_PROACTIVE_REVIEW) return;

    const validationError = modelValidationError?.key === settingsValidationKey(settings) ? modelValidationError.message : null;
    if (validationError) {
      appendMessage({
        id: id('error'),
        role: 'assistant',
        content: `Cannot use model \`${settings.model}\` yet. Save failed with: ${validationError}`,
        createdAt: Date.now(),
        kind: 'error',
      });
      setStatus('Model has a save error');
      return;
    }

    captureAnalyticsEvent('diagram_review_started', {
      mode,
      live_element_count: liveElements.length,
      auto_review_enabled: settings.autoReview,
    });

    setIsBusy(true);
    setStatus(mode === 'proactive' ? 'Proactively reviewing diagram...' : 'Reviewing diagram image...');
    const controller = new AbortController();
    inFlightAbortRef.current = controller;

    const assistantId = id('assistant');
    if (prompt?.trim()) {
      appendMessage({ id: id('user'), role: 'user', content: prompt.trim(), createdAt: Date.now(), kind: mode === 'manual' ? 'manual-review' : 'chat' });
    }
    appendMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      kind: mode === 'proactive' ? 'proactive-review' : mode === 'manual' ? 'manual-review' : 'chat',
    });

    try {
      const llmMessages = await buildLlmReviewMessages({ mode, userPrompt: prompt, designChangedSincePreviousReview });
      await llmProviderFactory.streamChat({
        settings,
        messages: llmMessages,
        signal: controller.signal,
        onToken: (token) => appendToken(assistantId, token),
      });
      lastReviewSignatureRef.current = currentSignature;
      if (mode === 'proactive' && current) {
        lastSentSignatureRef.current = currentSignature;
        firstUnsentChangeAtRef.current = null;
      }
      captureAnalyticsEvent('diagram_review_completed', { mode });
      setStatus(llmProviderFactory.getProviderStatus(settings));
    } catch (error) {
      const message = toErrorMessage(error);
      appendToken(
        assistantId,
        `\n\n⚠️ ${message}\n\nIf this mentions images or unsupported input, verify that the selected ${llmProviderFactory.getProviderName(settings.provider)} model \`${settings.model}\` supports vision payloads.`,
      );
      captureAnalyticsEvent('diagram_review_failed', { mode });
      setStatus(`${llmProviderFactory.getProviderName(settings.provider)} error`);
    } finally {
      setIsBusy(false);
      inFlightAbortRef.current = null;
    }
  };

  const handleSendChat = (prompt: string) => {
    void runAgentReview({ mode: 'chat', prompt });
  };

  const handleReview = (prompt?: string) => {
    void runAgentReview({ mode: 'manual', prompt: prompt || 'Please review this system-design diagram.' });
  };

  const handleTestConnection = async () => {
    if (isBusy) return false;
    const providerName = llmProviderFactory.getProviderName(settings.provider);
    const validationKey = settingsValidationKey(settings);
    setIsBusy(true);
    setStatus(`Saving and testing ${providerName}...`);
    try {
      const result = await llmProviderFactory.testConnection(settings);
      setModelValidationError(null);
      setStatus(`Saved · ${providerName} · ${settings.model}`);
      captureAnalyticsEvent('llm_connection_tested', { provider: settings.provider, ok: true, supports_vision: result.supportsVision });
      const visionNote = result.visionSupportKnown
        ? result.supportsVision
          ? 'The selected model advertises vision support.'
          : 'Warning: the selected model does not advertise vision support, so image-based review may fail or require a vision-capable model/tag.'
        : 'Vision support could not be verified from the provider model list; ensure the selected model supports image inputs.';
      appendMessage({
        id: id('status'),
        role: 'assistant',
        content: `Saved and verified ${providerName} at ${settings.endpoint}. Model: ${settings.model}. Test response: “${result.responseText ?? 'OK'}”. ${visionNote}`,
        createdAt: Date.now(),
        kind: result.supportsVision ? 'status' : 'error',
      });
      return true;
    } catch (error) {
      const errorText = toErrorMessage(error);
      const message = `Settings were saved, but ${providerName} could not complete a chat test with model \`${settings.model}\`. Fix the highlighted field/configuration before using this model. (${errorText})`;
      setModelValidationError({ key: validationKey, message: errorText });
      captureAnalyticsEvent('llm_connection_tested', { provider: settings.provider, ok: false });
      setStatus('Saved with model error');
      appendMessage({ id: id('error'), role: 'assistant', content: message, createdAt: Date.now(), kind: 'error' });
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  useEffect(() => {
    scheduleProactiveReview();
    return () => window.clearTimeout(proactiveTimerRef.current);
  }, [settings.autoReview]);

  useEffect(() => {
    return () => {
      window.clearTimeout(persistTimerRef.current);
      window.clearTimeout(proactiveTimerRef.current);
      inFlightAbortRef.current?.abort();
    };
  }, []);

  const resizeSidebarFromClientX = (clientX: number) => {
    setSidebarWidth(clampSidebarWidth(window.innerWidth - clientX));
  };

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    resizeSidebarFromClientX(event.clientX);
    document.body.classList.add('is-resizing-sidebar');

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      resizeSidebarFromClientX(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      document.body.classList.remove('is-resizing-sidebar');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });
  };

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSidebarWidth((width) => clampSidebarWidth(width + 24));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSidebarWidth((width) => clampSidebarWidth(width - 24));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setSidebarWidth(MIN_SIDEBAR_WIDTH);
    } else if (event.key === 'End') {
      event.preventDefault();
      setSidebarWidth(MAX_SIDEBAR_WIDTH);
    }
  };

  return (
    <main
      className={`app-shell theme-${settings.theme}`}
      style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
    >
      <section className="canvas-pane">
        <DiagramCanvas
          initialSnapshot={initialSnapshot}
          theme={settings.theme}
          onSnapshotChange={handleSnapshotChange}
          onApiReady={(api) => {
            apiRef.current = api;
          }}
        />
      </section>
      <div
        className="sidebar-resizer"
        role="separator"
        aria-label="Resize assistant sidebar"
        aria-orientation="vertical"
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        onPointerDown={handleResizePointerDown}
        onKeyDown={handleResizeKeyDown}
      />
      <AssistantPanel
        messages={messages}
        settings={settings}
        isBusy={isBusy}
        status={status}
        modelValidationError={modelValidationError?.key === settingsValidationKey(settings) ? modelValidationError.message : null}
        onSendChat={handleSendChat}
        onReview={handleReview}
        onSettingsChange={handleSettingsChange}
        onClearChat={() => {
          captureAnalyticsEvent('chat_cleared');
          setMessages([]);
        }}
        onTestConnection={handleTestConnection}
      />
    </main>
  );
}
