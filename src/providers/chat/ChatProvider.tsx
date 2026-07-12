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
  const {
    activeTab,
    snapshotRef,
    getCurrentSnapshot,
    getSnapshotForTab,
    isTabActive,
    replaceSnapshotForTab,
    saveTab,
  } = useWorkspaceTabManager();
  const { messages, setMessages, handleClearChat } = useChatMessages();
  const setSettings = useCallback((next: AppSettings | ((current: AppSettings) => AppSettings)) => {
    handleSettingsChange(typeof next === 'function' ? next(settings) : next);
  }, [handleSettingsChange, settings]);

  const createDiagramPlanSession = useCallback(() => {
    const targetTab = activeTab;
    if (!targetTab?.isSupported || targetTab.isUntitled || targetTab.loadState !== 'loaded') return null;
    const targetId = targetTab.id;

    const assertTargetActive = () => {
      if (!isTabActive(targetId)) throw new Error('The active diagram changed while the edit was running. No changes were committed.');
    };

    return {
      getSnapshot: () => {
        assertTargetActive();
        return getSnapshotForTab(targetId);
      },
      applyPlan: async (plan: DiagramPlanProposal) => {
        assertTargetActive();
        const currentSnapshot = getSnapshotForTab(targetId);
        if (!currentSnapshot) throw new Error('The target diagram is no longer available.');

        diagramAgentLogger.planApplying(plan, { type: 'current' });
        const nextSnapshot = diagramToolRuntime.applyPlan(currentSnapshot, plan);
        assertTargetActive();
        if (!replaceSnapshotForTab(targetId, nextSnapshot)) throw new Error('The target diagram is not ready to receive changes.');
        try {
          await saveTab(targetId, { throwOnError: true });
        } catch (error) {
          replaceSnapshotForTab(targetId, currentSnapshot);
          throw error;
        }
        diagramAgentLogger.planApplied({
          tabId: targetId,
          beforeElementCount: currentSnapshot.elements.filter((element) => !element.isDeleted).length,
          afterElementCount: nextSnapshot.elements.filter((element) => !element.isDeleted).length,
        });
      },
    };
  }, [activeTab, getSnapshotForTab, isTabActive, replaceSnapshotForTab, saveTab]);

  const agentReview = useAgentReview({
    settings,
    messages,
    setSettings,
    setMessages,
    snapshotRef,
    getCurrentSnapshot,
    createDiagramPlanSession,
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
    handleCancel,
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
        handleCancel,
        handleClearChat,
        handleTestConnection,
        handleWorkspaceSnapshotChanged: scheduleProactiveReview,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}
