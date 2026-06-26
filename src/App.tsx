import { useEffect, useMemo, useRef, useState } from 'react';
import { AssistantPanel } from './components/AssistantPanel';
import { DiagramCanvas } from './components/DiagramCanvas';
import { exportDiagramImage } from './lib/diagramImage';
import { formatDiagramSummary, meaningfulSceneSignature } from './lib/diagramSummary';
import { ARCHITECTURE_REVIEWER_SYSTEM_PROMPT, buildReviewPrompt } from './lib/llm/prompts';
import { streamOllamaChat, testOllamaConnection, type OllamaMessage } from './lib/llm/ollama';
import { loadChat, loadScene, loadSettings, saveChat, saveScene, saveSettings } from './lib/storage';
import type { AppSettings, ChatMessage, DiagramSnapshot, ExcalidrawApi } from './types';
import './styles.css';

const AUTO_REVIEW_INTERVAL_MS = 20_000;
const AUTO_REVIEW_MAX_WAIT_MS = 60_000;
const MIN_ELEMENTS_FOR_PROACTIVE_REVIEW = 2;

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

export default function App() {
  const initialSnapshot = useMemo(() => loadScene(), []);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChat());
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState('Local Ollama · gemma4:e4b');

  const apiRef = useRef<ExcalidrawApi | null>(null);
  const snapshotRef = useRef<DiagramSnapshot | null>(initialSnapshot);
  const persistTimerRef = useRef<number | undefined>(undefined);
  const proactiveTimerRef = useRef<number | undefined>(undefined);
  const firstUnsentChangeAtRef = useRef<number | null>(null);
  const lastSentSignatureRef = useRef('');
  const isBusyRef = useRef(false);
  const inFlightAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    saveSettings(settings);
    setStatus(`Local Ollama · ${settings.model}`);
  }, [settings]);

  useEffect(() => {
    saveChat(messages);
  }, [messages]);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

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
    persistTimerRef.current = window.setTimeout(() => saveScene(nextSnapshot), 600);

    scheduleProactiveReview();
  };

  const buildImageMessages = async (mode: 'manual' | 'proactive' | 'chat', userPrompt?: string): Promise<OllamaMessage[]> => {
    const current = snapshotRef.current;
    if (!current) throw new Error('No diagram is available yet. Draw something first.');

    const diagram = await exportDiagramImage(current);
    const metadata = formatDiagramSummary(diagram.summary);
    const prompt = buildReviewPrompt({ userPrompt, metadata, mode, thinkingLevel: settings.thinkingLevel });

    return [
      { role: 'system', content: ARCHITECTURE_REVIEWER_SYSTEM_PROMPT },
      { role: 'user', content: prompt, images: [diagram.base64] },
    ];
  };

  const runAgentReview = async ({ mode, prompt }: { mode: 'manual' | 'proactive' | 'chat'; prompt?: string }) => {
    if (isBusy) return;
    const current = snapshotRef.current;
    if (!current) {
      appendMessage({ id: id('err'), role: 'assistant', content: 'Draw a diagram first, then ask me to review it.', createdAt: Date.now(), kind: 'status' });
      return;
    }

    const liveElements = current.elements.filter((element) => !element.isDeleted);
    if (mode === 'proactive' && liveElements.length < MIN_ELEMENTS_FOR_PROACTIVE_REVIEW) return;

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
      const ollamaMessages = await buildImageMessages(mode, prompt);
      await streamOllamaChat({
        settings,
        messages: ollamaMessages,
        signal: controller.signal,
        onToken: (token) => appendToken(assistantId, token),
      });
      if (mode === 'proactive' && current) {
        lastSentSignatureRef.current = meaningfulSceneSignature(current);
        firstUnsentChangeAtRef.current = null;
      }
      setStatus(`Local Ollama · ${settings.model}`);
    } catch (error) {
      const message = toErrorMessage(error);
      appendToken(
        assistantId,
        `\n\n⚠️ ${message}\n\nIf this mentions images or unsupported input, verify that Ollama model \`${settings.model}\` supports vision payloads.`,
      );
      setStatus('Ollama error');
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
    setStatus('Testing Ollama...');
    try {
      const result = await testOllamaConnection(settings);
      setStatus(`Connected to Ollama · ${settings.model}`);
      const visionNote = result.supportsVision
        ? 'The selected model advertises vision support.'
        : 'Warning: the selected model does not advertise vision support in Ollama capabilities, so image-based review may fail or require a vision-capable local model/tag.';
      appendMessage({ id: id('status'), role: 'assistant', content: `Connected to local Ollama at ${settings.ollamaEndpoint}. Default model: ${settings.model}. ${visionNote}`, createdAt: Date.now(), kind: result.supportsVision ? 'status' : 'error' });
    } catch (error) {
      const message = `Cannot reach local Ollama at ${settings.ollamaEndpoint}. Start it with \`ollama serve\` and ensure \`${settings.model}\` is available. (${toErrorMessage(error)})`;
      setStatus('Ollama unavailable');
      appendMessage({ id: id('error'), role: 'assistant', content: message, createdAt: Date.now(), kind: 'error' });
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

  return (
    <main className={`app-shell theme-${settings.theme}`}>
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
      <AssistantPanel
        messages={messages}
        settings={settings}
        isBusy={isBusy}
        status={status}
        onSendChat={handleSendChat}
        onReview={handleReview}
        onSettingsChange={setSettings}
        onClearChat={() => setMessages([])}
        onTestConnection={handleTestConnection}
      />
    </main>
  );
}
