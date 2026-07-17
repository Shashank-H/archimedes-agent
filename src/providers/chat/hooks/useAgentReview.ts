import { type Dispatch, type RefObject, type SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { useLlmReviewContext } from '../../../hooks/useLlmReviewContext';
import { captureAnalyticsEvent } from '../../../lib/analytics';
import { assistantWorkflow } from '../../../lib/assistant-agent/workflow';
import type { AssistantIntent, AssistantWorkflowStep } from '../../../lib/assistant-agent/types';
import { ExcalidrawToolset } from '../../../lib/assistant-agent/tools/ExcalidrawToolset';
import { diagramAgentLogger } from '../../../lib/diagram-agent/logging';
import type { DiagramPlanProposal } from '../../../lib/diagram-agent/types';
import { meaningfulSceneSignature } from '../../../lib/diagramSummary';
import { llmProviderFactory } from '../../../lib/llm/provider';
import { normalizeReviewDelayMs, normalizeReviewTimeoutMs } from '../../../lib/reviewTiming';
import { settingsValidationKey } from '../../../lib/settingsValidation';
import type { AppSettings, ChatMessage, DiagramSnapshot, LlmChatMessage } from '../../../types';
import { CHAT_COPY, ChatMessageKind, MIN_ELEMENTS_FOR_PROACTIVE_REVIEW } from '../constants';

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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
  const settingsRef = useRef(settings);
  const runAssistantRef = useRef<((prompt: string, forcedIntent?: AssistantIntent) => Promise<void>) | null>(null);
  const buildLlmReviewMessages = useLlmReviewContext({ settings, messages, getSnapshot: getCurrentSnapshot });
  settingsRef.current = settings;

  const updateMessages = useCallback((updater: (messages: ChatMessage[]) => ChatMessage[]) => {
    setMessages((current) => updater(current));
  }, [setMessages]);

  const appendMessage = useCallback((message: ChatMessage) => {
    updateMessages((current) => [...current, message]);
  }, [updateMessages]);

  const replaceMessageContent = useCallback((messageId: string, content: string) => {
    updateMessages((current) => current.map((message) => message.id === messageId ? { ...message, content } : message));
  }, [updateMessages]);

  const updateWorkflowStep = useCallback((messageId: string, step: AssistantWorkflowStep) => {
    updateMessages((current) => current.map((message) => {
      if (message.id !== messageId) return message;
      const steps = message.workflowSteps ?? [];
      const existing = steps.some((candidate) => candidate.id === step.id);
      return {
        ...message,
        workflowSteps: existing
          ? steps.map((candidate) => candidate.id === step.id ? step : candidate)
          : [...steps, step],
      };
    }));
  }, [updateMessages]);

  const complete = useCallback(async (llmMessages: LlmChatMessage[], signal: AbortSignal) => {
    let content = '';
    await llmProviderFactory.streamChat({
      settings,
      messages: llmMessages,
      signal,
      onToken: (token) => { content += token; },
      onSettingsChange: setSettings,
    });
    return content;
  }, [settings, setSettings]);

  const runAssistant = useCallback(async (prompt: string, forcedIntent?: AssistantIntent) => {
    if (isBusyRef.current) return;
    const request = prompt.trim();
    if (!request) return;

    const validationError = modelValidationError?.key === settingsValidationKey(settings) ? modelValidationError.message : null;
    if (validationError) {
      appendMessage({
        id: id('error'), role: 'assistant', kind: ChatMessageKind.Error, createdAt: Date.now(),
        content: `Cannot use model \`${settings.model}\` yet. Save failed with: ${validationError}`,
      });
      setStatus(CHAT_COPY.modelSaveErrorStatus);
      return;
    }

    const current = snapshotRef.current;
    const currentSignature = current ? meaningfulSceneSignature(current) : '';
    const designChanged = forcedIntent === 'proactive_review' && Boolean(lastReviewSignatureRef.current) && currentSignature !== lastReviewSignatureRef.current;
    const diagramSession = createDiagramPlanSession();
    const controller = new AbortController();
    const assistantId = id('assistant');
    let editCommitted = false;

    // Acquire the workflow lock synchronously. React state updates are not a
    // mutex and leave a same-tick window for double-submit/proactive overlap.
    isBusyRef.current = true;
    inFlightAbortRef.current = controller;

    if (!forcedIntent) appendMessage({ id: id('user'), role: 'user', content: request, createdAt: Date.now(), kind: ChatMessageKind.Chat });
    appendMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      kind: forcedIntent === 'proactive_review' ? ChatMessageKind.ProactiveReview : ChatMessageKind.Chat,
      workflowSteps: [],
    });

    setIsBusy(true);
    setStatus('Understanding request...');
    captureAnalyticsEvent('assistant_workflow_started', { source: forcedIntent ? 'proactive' : 'user', has_diagram: Boolean(current) });

    try {
      const result = await assistantWorkflow.run(request, {
        signal: controller.signal,
        hasDiagram: Boolean(diagramSession),
        complete,
        tools: diagramSession ? new ExcalidrawToolset({
          getSnapshot: diagramSession.getSnapshot,
          applyPlan: async (plan) => {
            await diagramSession.applyPlan(plan);
            editCommitted = true;
          },
        }).definitions() : [],
        onStep: (step) => {
          setStatus(`${step.label}${step.detail ? ` · ${step.detail}` : step.status === 'running' ? '...' : ''}`);
          updateWorkflowStep(assistantId, step);
        },
        buildMessages: async (intent) => buildLlmReviewMessages({
          mode: intent === 'proactive_review'
            ? 'proactive_review'
            : intent === 'review' || intent === 'review_edit' ? 'review' : 'chat',
          userPrompt: request,
          designChangedSincePreviousReview: designChanged,
        }),
      }, forcedIntent ? { intent: forcedIntent } : undefined);

      replaceMessageContent(assistantId, result.response);
      lastReviewSignatureRef.current = currentSignature;
      if (forcedIntent === 'proactive_review') {
        lastSentSignatureRef.current = currentSignature;
        firstUnsentChangeAtRef.current = null;
      }
      captureAnalyticsEvent('assistant_workflow_completed', { intent: result.intent });
      diagramAgentLogger.requestCompleted({ responseLength: result.response.length, planDetected: result.intent === 'edit' || result.intent === 'review_edit' });
      setStatus(llmProviderFactory.getProviderStatus(settings));
    } catch (error) {
      if (controller.signal.aborted) {
        replaceMessageContent(
          assistantId,
          editCommitted
            ? 'Request cancelled after the diagram changes were saved.'
            : 'Request cancelled. No diagram changes were committed.',
        );
        setStatus('Cancelled');
      } else {
        const message = toErrorMessage(error);
        replaceMessageContent(assistantId, `⚠️ ${message}`);
        diagramAgentLogger.failure('assistant workflow', error);
        captureAnalyticsEvent('assistant_workflow_failed', { source: forcedIntent ? 'proactive' : 'user' });
        setStatus(`${llmProviderFactory.getProviderName(settings.provider)} error`);
      }
    } finally {
      if (inFlightAbortRef.current === controller) {
        isBusyRef.current = false;
        inFlightAbortRef.current = null;
        setIsBusy(false);
      }
    }
  }, [appendMessage, buildLlmReviewMessages, complete, createDiagramPlanSession, modelValidationError, replaceMessageContent, settings, snapshotRef, updateWorkflowStep]);

  runAssistantRef.current = runAssistant;

  const scheduleProactiveReview = useCallback(() => {
    window.clearTimeout(proactiveTimerRef.current);
    const currentSettings = settingsRef.current;
    if (!currentSettings.autoReview) {
      firstUnsentChangeAtRef.current = null;
      return;
    }
    const current = snapshotRef.current;
    if (!current) return;
    const liveElements = current.elements.filter((element) => !element.isDeleted);
    const signature = meaningfulSceneSignature(current);
    if (liveElements.length < MIN_ELEMENTS_FOR_PROACTIVE_REVIEW || !signature || signature === lastSentSignatureRef.current) {
      firstUnsentChangeAtRef.current = null;
      return;
    }
    const delayMs = normalizeReviewDelayMs(currentSettings.proactiveDelayMs);
    const timeoutMs = normalizeReviewTimeoutMs(currentSettings.proactiveCooldownMs);
    const now = Date.now();
    firstUnsentChangeAtRef.current ??= now;
    const delay = Math.max(0, Math.min(delayMs, timeoutMs - (now - firstUnsentChangeAtRef.current)));
    proactiveTimerRef.current = window.setTimeout(() => {
      const latest = snapshotRef.current;
      const latestSignature = latest ? meaningfulSceneSignature(latest) : '';
      const latestElementCount = latest?.elements.filter((element) => !element.isDeleted).length ?? 0;
      if (!settingsRef.current.autoReview || latest !== current || latestSignature !== signature
        || latestElementCount < MIN_ELEMENTS_FOR_PROACTIVE_REVIEW) {
        firstUnsentChangeAtRef.current = null;
        return;
      }
      if (isBusyRef.current) {
        proactiveTimerRef.current = window.setTimeout(scheduleProactiveReview, delayMs);
        return;
      }
      void runAssistantRef.current?.('Review the latest diagram change and offer one concise, actionable observation.', 'proactive_review');
    }, delay);
  }, [snapshotRef]);

  const handleAssistantRequest = useCallback((prompt: string) => { void runAssistant(prompt); }, [runAssistant]);
  const handleCancel = useCallback(() => { inFlightAbortRef.current?.abort(); }, []);

  const handleTestConnection = useCallback(async () => {
    if (isBusyRef.current) return false;
    isBusyRef.current = true;
    const providerName = llmProviderFactory.getProviderName(settings.provider);
    const validationKey = settingsValidationKey(settings);
    setIsBusy(true);
    setStatus(`Saving and testing ${providerName}...`);
    try {
      const result = await llmProviderFactory.testConnection(settings, setSettings);
      setModelValidationError(null);
      setSettings((currentSettings) => settingsValidationKey(currentSettings) === validationKey
        ? { ...currentSettings, providerConfigurationTestedKey: validationKey }
        : currentSettings);
      setStatus(`Saved · ${providerName} · ${settings.model}`);
      const visionNote = result.visionSupportKnown
        ? result.supportsVision ? 'The selected model advertises vision support.' : 'Warning: the selected model does not advertise vision support.'
        : 'Vision support could not be verified; diagram review and editing require image input support.';
      appendMessage({
        id: id('status'), role: 'assistant', createdAt: Date.now(), kind: result.supportsVision ? 'status' : 'error',
        content: `Saved and verified ${providerName} at ${settings.endpoint}. Model: ${settings.model}. Test response: “${result.responseText ?? 'OK'}”. ${visionNote}`,
      });
      return true;
    } catch (error) {
      const errorText = toErrorMessage(error);
      setModelValidationError({ key: validationKey, message: errorText });
      setStatus(CHAT_COPY.savedWithModelErrorStatus);
      appendMessage({
        id: id('error'), role: 'assistant', kind: ChatMessageKind.Error, createdAt: Date.now(),
        content: `Settings were saved, but ${providerName} could not complete a chat test with model \`${settings.model}\`. (${errorText})`,
      });
      return false;
    } finally {
      isBusyRef.current = false;
      setIsBusy(false);
    }
  }, [appendMessage, settings, setSettings]);

  useEffect(() => {
    if (!settings.autoReview) {
      window.clearTimeout(proactiveTimerRef.current);
      firstUnsentChangeAtRef.current = null;
    }
  }, [settings.autoReview]);

  useEffect(() => () => {
    window.clearTimeout(proactiveTimerRef.current);
    inFlightAbortRef.current?.abort();
  }, []);

  return {
    isBusy,
    status,
    modelValidationError,
    setStatus,
    setModelValidationError,
    scheduleProactiveReview,
    handleAssistantRequest,
    handleCancel,
    handleTestConnection,
  };
}
