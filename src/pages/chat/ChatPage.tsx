import { useMemo } from 'react';
import { useChat } from '../../providers/chat/ChatContext';
import { useWorkspace } from '../../providers/workspace/WorkspaceContext';
import { ChatComposer } from './components/ChatComposer';
import { MessageList } from './components/MessageList';
import { CHAT_EMPTY_STATES, CHAT_SECTION_TABS } from './constants';
import { useChatSectionTabs } from './hooks/useChatSectionTabs';

export function ChatPage() {
  const { settings, handleSettingsChange } = useWorkspace();
  const { activeTab, setActiveTab } = useChatSectionTabs();
  const {
    messages,
    isBusy,
    handleSendChat,
    handleDiagrammingRequest,
    handleReview,
    handleClearChat,
  } = useChat();
  const visibleMessages = useMemo(
    () => messages.filter((message) => activeTab === 'diagramming' ? message.kind === 'diagramming' : message.kind !== 'diagramming'),
    [activeTab, messages],
  );

  return (
    <>
      <div className="chat-section-tabs" role="tablist" aria-label="Chat mode">
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
          onSendChat={activeTab === 'diagramming' ? handleDiagrammingRequest : handleSendChat}
          onReview={handleReview}
          onSettingsChange={handleSettingsChange}
          onClearChat={handleClearChat}
        />
      </section>
    </>
  );
}
