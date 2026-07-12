import { useCallback, useEffect, type ReactNode } from 'react';
import { diagramAgentLogger } from '../../lib/diagram-agent/logging';
import { diagramToolRuntime } from '../../lib/diagram-agent/runtime';
import type { DiagramPlanProposal } from '../../lib/diagram-agent/types';
import { llmProviderFactory } from '../../lib/llm/provider';
import { settingsValidationKey } from '../../lib/settingsValidation';
import type { AppSettings } from '../../types';
import { useWorkspace } from '../workspace/WorkspaceContext';
import { useWorkspaceTabManager } from '../workspace/tabs/WorkspaceTabManagerContext';
import { ChatContext } from './ChatContext';
import { useAgentReview } from './hooks/useAgentReview';
import { useChatMessages } from './hooks/useChatMessages';

export function ChatProvider({ children }: { children: ReactNode }) {
  const { settings, handleSettingsChange } = useWorkspace();
  const { activeTab, snapshotRef, getCurrentSnapshot, replaceActiveSnapshot, saveActiveTab } = useWorkspaceTabManager();
  const { messages, setMessages, handleClearChat } = useChatMessages();
  const setSettings = useCallback((next: AppSettings | ((current: AppSettings) => AppSettings)) => {
    handleSettingsChange(typeof next === 'function' ? next(settings) : next);
  }, [handleSettingsChange, settings]);

  const canApplyDiagramPlan = useCallback(
    () => Boolean(activeTab?.isSupported && !activeTab.isUntitled && activeTab.loadState === 'loaded'),
    [activeTab],
  );

  const applyDiagramPlan = useCallback(async (plan: DiagramPlanProposal) => {
    if (!canApplyDiagramPlan() || !activeTab) {
      throw new Error('Select and open an Excalidraw file before asking me to draw on it.');
    }

    const currentSnapshot = getCurrentSnapshot();
    if (!currentSnapshot) throw new Error('The opened Excalidraw file is still loading. Try again once it is ready.');

    diagramAgentLogger.planApplying(plan, { type: 'current' });
    const nextSnapshot = diagramToolRuntime.applyPlan(currentSnapshot, plan);
    if (!replaceActiveSnapshot(nextSnapshot)) throw new Error('The opened Excalidraw file is not ready to receive changes.');
    await saveActiveTab();
    diagramAgentLogger.planApplied({
      tabId: activeTab.id,
      beforeElementCount: currentSnapshot.elements.filter((element) => !element.isDeleted).length,
      afterElementCount: nextSnapshot.elements.filter((element) => !element.isDeleted).length,
    });
  }, [activeTab, canApplyDiagramPlan, getCurrentSnapshot, replaceActiveSnapshot, saveActiveTab]);

  const agentReview = useAgentReview({
    settings,
    messages,
    setSettings,
    setMessages,
    snapshotRef,
    getCurrentSnapshot,
    onApplyDiagramPlan: applyDiagramPlan,
    canApplyDiagramPlan,
  });
  const {
    isBusy,
    status,
    modelValidationError,
    setStatus,
    scheduleProactiveReview,
    handleSendChat,
    handleDiagrammingRequest,
    handleReview,
    handleTestConnection,
  } = agentReview;

  useEffect(() => {
    setStatus(llmProviderFactory.getProviderStatus(settings));
  }, [setStatus, settings]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isBusy,
        status,
        modelValidationError,
        currentModelValidationError: modelValidationError?.key === settingsValidationKey(settings) ? modelValidationError.message : null,
        handleSendChat,
        handleDiagrammingRequest,
        handleReview,
        handleClearChat,
        handleTestConnection,
        handleWorkspaceSnapshotChanged: scheduleProactiveReview,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
