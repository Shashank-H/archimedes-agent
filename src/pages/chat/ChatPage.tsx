import { AssistantHeader } from '../../components/ui/AssistantHeader';
import { useChat } from '../../providers/chat/ChatContext';
import { useWorkspace } from '../../providers/workspace/WorkspaceContext';
import { ChatComposer } from './components/ChatComposer';
import { MessageList } from './components/MessageList';

export function ChatPage() {
  const { settings, handleSettingsChange } = useWorkspace();
  const {
    messages,
    isBusy,
    status,
    handleSendChat,
    handleReview,
    handleClearChat,
  } = useChat();

  return (
    <>
      <AssistantHeader status={status} />
      <MessageList messages={messages} />
      <ChatComposer
        messages={messages}
        settings={settings}
        isBusy={isBusy}
        onSendChat={handleSendChat}
        onReview={handleReview}
        onSettingsChange={handleSettingsChange}
        onClearChat={handleClearChat}
      />
    </>
  );
}
