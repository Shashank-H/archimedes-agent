import { useCallback, useEffect, useState } from 'react';
import { captureAnalyticsEvent } from '../../../lib/analytics';
import { appStorage } from '../../../lib/storage';
import type { ChatMessage } from '../../../types';

export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => appStorage.loadChat());

  useEffect(() => {
    appStorage.saveChat(messages);
  }, [messages]);

  const handleClearChat = useCallback(() => {
    captureAnalyticsEvent('chat_cleared');
    setMessages([]);
  }, []);

  return { messages, setMessages, handleClearChat };
}
