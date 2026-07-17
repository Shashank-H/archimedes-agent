import { useChat } from '../../providers/chat/ChatContext';
import { useWorkspace } from '../../providers/workspace/WorkspaceContext';
import { ChatComposer } from './components/ChatComposer';
import { MessageList } from './components/MessageList';
import { ASSISTANT_EMPTY_STATE } from './constants';

export function ChatPage() {
  const { settings, handleSettingsChange } = useWorkspace();
  const {
    messages,
    isBusy,
    handleAssistantRequest,
    handleCancel,
    handleClearChat,
  } = useChat();

  return (
    <section className="chat-section-panel" aria-label="Archimedes assistant">
      <MessageList messages={messages} emptyState={ASSISTANT_EMPTY_STATE} />
      <ChatComposer
        messages={messages}
        settings={settings}
        isBusy={isBusy}
        onSubmit={handleAssistantRequest}
        onCancel={handleCancel}
        onSettingsChange={handleSettingsChange}
        onClearChat={handleClearChat}
      />
    </section>
  );
}
