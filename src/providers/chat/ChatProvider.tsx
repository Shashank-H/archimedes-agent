import { useCallback, useEffect, type ReactNode } from 'react';
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
  const { snapshotRef, getCurrentSnapshot } = useWorkspaceTabManager();
  const { messages, setMessages, handleClearChat } = useChatMessages();
  const setSettings = useCallback((next: AppSettings | ((current: AppSettings) => AppSettings)) => {
    handleSettingsChange(typeof next === 'function' ? next(settings) : next);
  }, [handleSettingsChange, settings]);
  const agentReview = useAgentReview({
    settings,
    messages,
    setSettings,
    setMessages,
    snapshotRef,
    getCurrentSnapshot,
  });
  const {
    isBusy,
    status,
    modelValidationError,
    setStatus,
    scheduleProactiveReview,
    handleSendChat,
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
