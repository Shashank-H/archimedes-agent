import { useState } from 'react';
import type { ChatSectionTab } from '../constants';

export function useChatSectionTabs() {
  const [activeTab, setActiveTab] = useState<ChatSectionTab>('review');
  return { activeTab, setActiveTab };
}
