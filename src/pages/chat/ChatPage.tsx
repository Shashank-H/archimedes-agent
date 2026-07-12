import { useMemo } from 'react';
import { useChat } from '../../providers/chat/ChatContext';
import { useWorkspace } from '../../providers/workspace/WorkspaceContext';
import type { ChatMessage } from '../../types';
import { ChatComposer } from './components/ChatComposer';
import { MessageList } from './components/MessageList';
import { CHAT_EMPTY_STATES, CHAT_SECTION_TABS, type ChatSectionTab } from './constants';
import { useChatSectionTabs } from './hooks/useChatSectionTabs';

function belongsToMode(message: ChatMessage, mode: ChatSectionTab) {
  if (mode === 'edit') return message.kind === 'diagramming';
  if (mode === 'chat') return message.kind === 'chat';
  return message.kind !== 'diagramming' && message.kind !== 'chat';
}

export function ChatPage() {
  const { settings, handleSettingsChange } = useWorkspace();
  const { activeTab, setActiveTab } = useChatSectionTabs();
  const {
    messages,
    isBusy,
    handleSendChat,
    handleDiagrammingRequest,
    handleReview,
    handleCancel,
    handleClearChat,
  } = useChat();
  const visibleMessages = useMemo(
    () => messages.filter((message) => belongsToMode(message, activeTab)),
    [activeTab, messages],
  );

  return (
    <>
      <div className="chat-section-tabs" role="tablist" aria-label="Assistant mode">
        {CHAT_SECTION_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`chat-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`chat-panel-${tab.id}`}
            className={`chat-section-tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section id={`chat-panel-${activeTab}`} role="tabpanel" aria-labelledby={`chat-tab-${activeTab}`} className="chat-section-panel">
        <MessageList messages={visibleMessages} emptyState={CHAT_EMPTY_STATES[activeTab]} />
        <ChatComposer
          mode={activeTab}
          messages={visibleMessages}
          settings={settings}
          isBusy={isBusy}
          onSendChat={activeTab === 'edit' ? handleDiagrammingRequest : handleSendChat}
          onReview={handleReview}
          onCancel={handleCancel}
          onSettingsChange={handleSettingsChange}
          onClearChat={handleClearChat}
        />
      </section>
    </>
  );
}
