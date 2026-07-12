import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { captureAnalyticsEvent } from '../../../lib/analytics';

import { DIAGRAM_AGENT_STEPS, type DiagramAgentStep } from '../../../lib/diagram-agent/constants';
import { diagramAgentLogger } from '../../../lib/diagram-agent/logging';
import { diagramAgentWorkflow } from '../../../lib/diagram-agent/workflow';
import type { DiagramPlanProposal } from '../../../lib/diagram-agent/types';
import { meaningfulSceneSignature } from '../../../lib/diagramSummary';
import { exportDiagramImage } from '../../../lib/diagramImage';
import { llmProviderFactory } from '../../../lib/llm/provider';
import { normalizeReviewDelayMs, normalizeReviewTimeoutMs } from '../../../lib/reviewTiming';
import { settingsValidationKey } from '../../../lib/settingsValidation';
import { useLlmReviewContext } from '../../../hooks/useLlmReviewContext';
import type { AppSettings, ChatMessage, DiagramSnapshot } from '../../../types';
import { CHAT_COPY, ChatMessageKind, MIN_ELEMENTS_FOR_PROACTIVE_REVIEW, ReviewMode } from '../constants';

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

type ModelValidationError = { key: string; message: string } | null;

export type DiagramPlanSession = {
  getSnapshot: () => DiagramSnapshot | null;
  applyPlan: (plan: DiagramPlanProposal) => Promise<void>;
};

type UseAgentReviewOptions = {
  settings: AppSettings;
  messages: ChatMessage[];
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  snapshotRef: RefObject<DiagramSnapshot | null>;
  getCurrentSnapshot: () => DiagramSnapshot | null;
  createDiagramPlanSession: () => DiagramPlanSession | null;
};

export function useAgentReview({ settings, messages, setSettings, setMessages, snapshotRef, getCurrentSnapshot, createDiagramPlanSession }: UseAgentReviewOptions) {
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState(() => llmProviderFactory.getProviderStatus(settings));
  const [modelValidationError, setModelValidationError] = useState<ModelValidationError>(null);
  const proactiveTimerRef = useRef<number | undefined>(undefined);
  const firstUnsentChangeAtRef = useRef<number | null>(null);
  const lastSentSignatureRef = useRef('');
  const lastReviewSignatureRef = useRef('');
  const isBusyRef = useRef(false);
  const inFlightAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isBusyRef.current = isBusy;
  }, [isBusy]);

  const buildLlmReviewMessages = useLlmReviewContext({ settings, messages, getSnapshot: getCurrentSnapshot });

  const updateMessages = useCallback((updater: (messages: ChatMessage[]) => ChatMessage[]) => {
    setMessages((current) => updater(current));
  }, [setMessages]);

  const appendMessage = useCallback((message: ChatMessage) => {
    updateMessages((current) => [...current, message]);
  }, [updateMessages]);

  const replaceMessageContent = useCallback((messageId: string, content: string) => {
    updateMessages((current) => current.map((message) => (message.id === messageId ? { ...message, content } : message)));
  }, [updateMessages]);

  const updateWorkflowStep = useCallback((messageId: string, step: DiagramAgentStep) => {
    updateMessages((current) => current.map((message) => {
      if (message.id !== messageId) return message;
      const steps = message.workflowSteps ?? DIAGRAM_AGENT_STEPS.map((definition) => ({ ...definition, status: 'pending' as const }));
      return { ...message, workflowSteps: steps.map((currentStep) => currentStep.id === step.id ? step : currentStep) };
    }));
  }, [updateMessages]);

  const appendToken = useCallback((messageId: string, token: string) => {
    updateMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, content: message.content + token } : message,
      ),
    );
  }, [updateMessages]);

  const runAgentReview = useCallback(async ({ mode, prompt }: { mode: ReviewMode; prompt?: string }) => {
    if (isBusyRef.current) return;
    const diagramSession = mode === ReviewMode.Diagramming ? createDiagramPlanSession() : null;
    const current = diagramSession?.getSnapshot() ?? snapshotRef.current;
    if (mode === ReviewMode.Diagramming && !diagramSession) {
      const content = CHAT_COPY.selectFileFirst;
      appendMessage({ id: id('err'), role: 'assistant', content, createdAt: Date.now(), kind: ChatMessageKind.Diagramming });
      diagramAgentLogger.failure('diagram file inspection', new Error(content));
      return;
    }
    if (!current && mode !== ReviewMode.Chat) {
      const content = mode === ReviewMode.Diagramming ? CHAT_COPY.selectFileFirst : CHAT_COPY.drawFirst;
      appendMessage({ id: id('err'), role: 'assistant', content, createdAt: Date.now(), kind: ChatMessageKind.Status });
      diagramAgentLogger.failure('diagram file inspection', new Error(content));
      return;
    }

    const inspectedSnapshot = current ?? { elements: [], appState: {}, files: {}, updatedAt: Date.now() };
    const liveElements = inspectedSnapshot.elements.filter((element) => !element.isDeleted);
    const currentSignature = meaningfulSceneSignature(inspectedSnapshot);
    const designChangedSincePreviousReview = mode === ReviewMode.Proactive && Boolean(lastReviewSignatureRef.current) && currentSignature !== lastReviewSignatureRef.current;
    if (mode === ReviewMode.Proactive && liveElements.length < MIN_ELEMENTS_FOR_PROACTIVE_REVIEW) return;

    const validationError = modelValidationError?.key === settingsValidationKey(settings) ? modelValidationError.message : null;
    if (validationError) {
      appendMessage({
        id: id('error'),
        role: 'assistant',
        content: `Cannot use model \`${settings.model}\` yet. Save failed with: ${validationError}`,
        createdAt: Date.now(),
        kind: mode === ReviewMode.Diagramming ? ChatMessageKind.Diagramming : ChatMessageKind.Error,
      });
      setStatus(CHAT_COPY.modelSaveErrorStatus);
      return;
    }

    captureAnalyticsEvent('diagram_review_started', {
      mode,
      live_element_count: liveElements.length,
      auto_review_enabled: settings.autoReview,
    });
    diagramAgentLogger.inspectStarted({ tabId: null, elementCount: liveElements.length, mode });

    setIsBusy(true);
    setStatus(mode === ReviewMode.Proactive ? CHAT_COPY.proactiveStatus : CHAT_COPY.manualStatus);
    const controller = new AbortController();
    inFlightAbortRef.current = controller;

    const assistantId = id('assistant');
    if (prompt?.trim()) {
      appendMessage({ id: id('user'), role: 'user', content: prompt.trim(), createdAt: Date.now(), kind: mode === ReviewMode.Manual ? ChatMessageKind.ManualReview : mode === ReviewMode.Diagramming ? ChatMessageKind.Diagramming : ChatMessageKind.Chat });
    }
    appendMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      kind: mode === ReviewMode.Proactive ? ChatMessageKind.ProactiveReview : mode === ReviewMode.Manual ? ChatMessageKind.ManualReview : mode === ReviewMode.Diagramming ? ChatMessageKind.Diagramming : ChatMessageKind.Chat,
      workflowSteps: mode === ReviewMode.Diagramming
        ? DIAGRAM_AGENT_STEPS.map((step) => ({ ...step, status: 'pending' as const }))
        : undefined,
    });

    try {
      if (mode === ReviewMode.Diagramming) {
        const result = await diagramAgentWorkflow.run(prompt?.trim() ?? '', {
          getSnapshot: diagramSession!.getSnapshot,
          captureImage: async (snapshot) => {
            const image = await exportDiagramImage(snapshot);
            return { base64: image.base64, mimeType: image.mimeType };
          },
          signal: controller.signal,
          onStep: (step) => {
            setStatus(`${step.label}${step.detail ? ` · ${step.detail}` : '...'}`);
            updateWorkflowStep(assistantId, step);
          },
          complete: async (llmMessages, signal) => {
            let content = '';
            await llmProviderFactory.streamChat({
              settings,
              messages: llmMessages,
              signal,
              onToken: (token) => { content += token; },
              onSettingsChange: setSettings,
            });
            return content;
          },
          applyPlan: diagramSession!.applyPlan,
        });
        diagramAgentLogger.requestCompleted({ responseLength: result.response.length, planDetected: true });
        replaceMessageContent(assistantId, result.response);
      } else {
        let responseContent = '';
        const llmMessages = await buildLlmReviewMessages({ mode, userPrompt: prompt, designChangedSincePreviousReview });
        await llmProviderFactory.streamChat({
          settings,
          messages: llmMessages,
          signal: controller.signal,
          onToken: (token) => {
            responseContent += token;
            appendToken(assistantId, token);
          },
          onSettingsChange: setSettings,
        });
        diagramAgentLogger.requestCompleted({ responseLength: responseContent.length, planDetected: false });
      }
      lastReviewSignatureRef.current = currentSignature;
      if (mode === ReviewMode.Proactive && current) {
        lastSentSignatureRef.current = currentSignature;
        firstUnsentChangeAtRef.current = null;
      }
      captureAnalyticsEvent('diagram_review_completed', { mode });
      setStatus(llmProviderFactory.getProviderStatus(settings));
    } catch (error) {
      if (controller.signal.aborted) {
        replaceMessageContent(assistantId, 'Request cancelled before the diagram transaction was committed.');
        setStatus('Cancelled');
        return;
      }
      diagramAgentLogger.failure('agent request or diagram application', error);
      const message = toErrorMessage(error);
      const guidance = mode === ReviewMode.Diagramming
        ? 'The edit stopped before the diagram transaction was committed.'
        : `If this mentions images or unsupported input, verify that the selected ${llmProviderFactory.getProviderName(settings.provider)} model \`${settings.model}\` supports vision payloads.`;
      appendToken(assistantId, `\n\n⚠️ ${message}\n\n${guidance}`);
      captureAnalyticsEvent('diagram_review_failed', { mode });
      setStatus(`${llmProviderFactory.getProviderName(settings.provider)} error`);
    } finally {
      setIsBusy(false);
      inFlightAbortRef.current = null;
    }
  }, [appendMessage, appendToken, buildLlmReviewMessages, createDiagramPlanSession, modelValidationError, replaceMessageContent, settings, setSettings, snapshotRef, updateWorkflowStep]);

  const scheduleProactiveReview = useCallback(() => {
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

    const reviewDelayMs = normalizeReviewDelayMs(settings.proactiveDelayMs);
    const reviewTimeoutMs = normalizeReviewTimeoutMs(settings.proactiveCooldownMs);
    const now = Date.now();
    firstUnsentChangeAtRef.current ??= now;
    const maxWaitRemaining = reviewTimeoutMs - (now - firstUnsentChangeAtRef.current);
    const delay = Math.max(0, Math.min(reviewDelayMs, maxWaitRemaining));

    proactiveTimerRef.current = window.setTimeout(() => {
      if (isBusyRef.current) {
        proactiveTimerRef.current = window.setTimeout(scheduleProactiveReview, reviewDelayMs);
        return;
      }
      void runAgentReview({ mode: ReviewMode.Proactive });
    }, delay);
  }, [runAgentReview, settings.autoReview, settings.proactiveCooldownMs, settings.proactiveDelayMs, snapshotRef]);

  const handleSendChat = useCallback((prompt: string) => {
    void runAgentReview({ mode: ReviewMode.Chat, prompt });
  }, [runAgentReview]);

  const handleDiagrammingRequest = useCallback((prompt: string) => {
    void runAgentReview({ mode: ReviewMode.Diagramming, prompt });
  }, [runAgentReview]);

  const handleReview = useCallback((prompt?: string) => {
    void runAgentReview({ mode: ReviewMode.Manual, prompt: prompt || CHAT_COPY.defaultReviewPrompt });
  }, [runAgentReview]);

  const handleCancel = useCallback(() => {
    inFlightAbortRef.current?.abort();
    setStatus('Cancelled');
  }, []);

  const handleTestConnection = useCallback(async () => {
    if (isBusyRef.current) return false;
    const providerName = llmProviderFactory.getProviderName(settings.provider);
    const validationKey = settingsValidationKey(settings);
    setIsBusy(true);
    setStatus(`Saving and testing ${providerName}...`);
    try {
      const result = await llmProviderFactory.testConnection(settings, setSettings);
      setModelValidationError(null);
      setSettings((currentSettings) =>
        settingsValidationKey(currentSettings) === validationKey
          ? { ...currentSettings, providerConfigurationTestedKey: validationKey }
          : currentSettings,
      );
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
      setStatus(CHAT_COPY.savedWithModelErrorStatus);
      appendMessage({ id: id('error'), role: 'assistant', content: message, createdAt: Date.now(), kind: ChatMessageKind.Error });
      return false;
    } finally {
      setIsBusy(false);
    }
  }, [appendMessage, settings, setSettings]);

  useEffect(() => {
    if (!settings.autoReview) {
      window.clearTimeout(proactiveTimerRef.current);
      firstUnsentChangeAtRef.current = null;
    }
  }, [settings.autoReview]);

  useEffect(() => {
    return () => {
      window.clearTimeout(proactiveTimerRef.current);
      inFlightAbortRef.current?.abort();
    };
  }, []);

  return {
    isBusy,
    status,
    modelValidationError,
    setStatus,
    setModelValidationError,
    scheduleProactiveReview,
    handleSendChat,
    handleDiagrammingRequest,
    handleReview,
    handleCancel,
    handleTestConnection,
  };
}
