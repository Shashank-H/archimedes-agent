import { MarkdownMessage } from '../../../components/MarkdownMessage';
import type { ChatMessage } from '../../../types';
import { Icon } from '../../../components/ui/icons';

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="message-list">
      {messages.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-kicker"><Icon name="sparkles" size={14} /> No review yet</span>
          <strong>Draw a system design, then ask Archimedes for a review.</strong>
          <p>Switch to proactive mode for automatic diagram reviews, or keep manual mode and trigger review from the composer.</p>
        </div>
      ) : (
        messages.map((message) => (
          <article key={message.id} className={`message ${message.role} ${message.kind ?? ''}`}>
            <div className="message-meta">
              <span>{message.role === 'assistant' ? 'Archimedes' : message.role}</span>
              {message.kind && <small>{message.kind}</small>}
            </div>
            <div className="message-content">
              <MarkdownMessage content={message.content} />
            </div>
          </article>
        ))
      )}
    </div>
  );
}
