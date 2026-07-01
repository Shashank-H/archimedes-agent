import { createContext, useContext } from 'react';
import type { ChatMessage } from '../../types';

type ModelValidationError = { key: string; message: string } | null;

export type ChatContextValue = {
  messages: ChatMessage[];
  isBusy: boolean;
  status: string;
  modelValidationError: ModelValidationError;
  currentModelValidationError: string | null;
  handleSendChat: (prompt: string) => void;
  handleReview: (prompt?: string) => void;
  handleClearChat: () => void;
  handleTestConnection: () => boolean | Promise<boolean>;
  handleWorkspaceSnapshotChanged: () => void;
};

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat must be used within ChatProvider');
  return value;
}
