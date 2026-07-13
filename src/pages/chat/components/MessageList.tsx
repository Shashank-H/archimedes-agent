import { MarkdownMessage } from '../../../components/MarkdownMessage';
import chatPageStyles from '../ChatPage.module.css';
import type { ChatMessage } from '../../../types';
import { Icon } from '../../../components/ui/icons';

type MessageListProps = {
  messages: ChatMessage[];
  emptyState: { kicker: string; title: string; description: string };
};

export function MessageList({ messages, emptyState }: MessageListProps) {
  return (
    <div className={`message-list ${chatPageStyles.moduleAnchor}`}>
      {messages.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-kicker"><Icon name="sparkles" size={14} /> {emptyState.kicker}</span>
          <strong>{emptyState.title}</strong>
          <p>{emptyState.description}</p>
        </div>
      ) : (
        messages.map((message) => (
          <article key={message.id} className={`message ${message.role} ${message.kind ?? ''}`}>
            <div className="message-meta">
              <span>{message.role === 'assistant' ? 'Archimedes' : message.role}</span>
              {message.kind && <small>{message.kind}</small>}
            </div>
            <div className="message-content">
              {message.workflowSteps && message.workflowSteps.length > 0 && (
                <ol className={chatPageStyles.workflowSteps} aria-label="Agent workflow progress">
                  {message.workflowSteps.map((step) => (
                    <li key={step.id} data-status={step.status}>
                      <span aria-hidden="true">{step.status === 'completed' ? '✓' : step.status === 'failed' ? '!' : step.status === 'running' ? '●' : '○'}</span>
                      <span>{step.label}{step.detail ? ` · ${step.detail}` : ''}</span>
                    </li>
                  ))}
                </ol>
              )}
              <MarkdownMessage content={message.content} />
            </div>
          </article>
        ))
      )}
    </div>
  );
}
