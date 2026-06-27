import { useEffect, useRef, useState } from 'react';
import { MarkdownMessage } from './MarkdownMessage';
import type { AppSettings, ChatMessage, ThinkingLevel } from '../types';

type AssistantPanelProps = {
  messages: ChatMessage[];
  settings: AppSettings;
  isBusy: boolean;
  status: string;
  onSendChat: (prompt: string) => void;
  onReview: (prompt?: string) => void;
  onSettingsChange: (settings: AppSettings) => void;
  onClearChat: () => void;
  onTestConnection: () => void;
};

type IconName =
  | 'brain'
  | 'settings'
  | 'message'
  | 'plug'
  | 'moon'
  | 'zap'
  | 'sparkles'
  | 'play'
  | 'pause'
  | 'send'
  | 'trash'
  | 'user'
  | 'sliders'
  | 'chevronDown';

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'brain':
      return <svg {...common}><path d="M9.5 2A3.5 3.5 0 0 0 6 5.5v.3A3.7 3.7 0 0 0 3 9.5c0 1 .4 2 1.1 2.7A4.4 4.4 0 0 0 3 15.2 4.8 4.8 0 0 0 7.8 20H10V2h-.5Z"/><path d="M14.5 2A3.5 3.5 0 0 1 18 5.5v.3a3.7 3.7 0 0 1 3 3.7c0 1-.4 2-1.1 2.7a4.4 4.4 0 0 1 1.1 3A4.8 4.8 0 0 1 16.2 20H14V2h.5Z"/><path d="M7.5 9.5H10M14 9.5h2.5M8 14h2M14 14h2"/></svg>;
    case 'settings':
      return <svg {...common}><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
    case 'message':
      return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/></svg>;
    case 'plug':
      return <svg {...common}><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8h12Z"/></svg>;
    case 'moon':
      return <svg {...common}><path d="M20.9 13.5A8.5 8.5 0 1 1 10.5 3.1 6.7 6.7 0 0 0 20.9 13.5Z"/></svg>;
    case 'zap':
      return <svg {...common}><path d="M13 2 3 14h8l-1 8 11-14h-8l1-6Z"/></svg>;
    case 'sparkles':
      return <svg {...common}><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z"/></svg>;
    case 'play':
      return <svg {...common}><path d="m8 5 11 7-11 7V5Z"/></svg>;
    case 'pause':
      return <svg {...common}><path d="M10 4H6v16h4V4Z"/><path d="M18 4h-4v16h4V4Z"/></svg>;
    case 'send':
      return <svg {...common}><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg>;
    case 'trash':
      return <svg {...common}><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>;
    case 'user':
      return <svg {...common}><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'sliders':
      return <svg {...common}><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/></svg>;
    case 'chevronDown':
      return <svg {...common}><path d="m6 9 6 6 6-6"/></svg>;
  }
}

export function AssistantPanel({
  messages,
  settings,
  isBusy,
  status,
  onSendChat,
  onReview,
  onSettingsChange,
  onClearChat,
  onTestConnection,
}: AssistantPanelProps) {
  const [prompt, setPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resizePromptInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
  };

  useEffect(() => {
    resizePromptInput();
  }, [prompt]);

  const submit = () => {
    const value = prompt.trim();
    if (!value || isBusy) return;
    onSendChat(value);
    setPrompt('');
  };

  return (
    <aside className="assistant-panel">
      <header className="assistant-header">
        <div className="assistant-title">
          <span className="assistant-mark">
            <img className="logo-light" src="/logos/logo-light.svg" alt="" aria-hidden="true" />
            <img className="logo-dark" src="/logos/logo-dark.svg" alt="" aria-hidden="true" />
          </span>
          <div>
            <h1>Archimedes Agent</h1>
            <p>{status}</p>
          </div>
        </div>
        <div className="assistant-header-actions">
          <button
            className="settings-toggle"
            onClick={() => setShowSettings((value) => !value)}
            aria-label={showSettings ? 'Back to chat' : 'Open settings'}
            title={showSettings ? 'Back to chat' : 'Settings'}
          >
            <Icon name={showSettings ? 'message' : 'settings'} size={15} />
            <span>{showSettings ? 'Chat' : 'Settings'}</span>
          </button>
        </div>
      </header>

      {showSettings ? (
        <section className="settings-section">
          <label>
            Ollama endpoint
            <input
              value={settings.ollamaEndpoint}
              onChange={(event) => onSettingsChange({ ...settings, ollamaEndpoint: event.target.value })}
            />
          </label>
          <label>
            Model
            <input
              value={settings.model}
              onChange={(event) => onSettingsChange({ ...settings, model: event.target.value })}
            />
          </label>
          <label>
            Temperature: {settings.temperature.toFixed(1)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={(event) => onSettingsChange({ ...settings, temperature: Number(event.target.value) })}
            />
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.theme === 'dark'}
              onChange={(event) => onSettingsChange({ ...settings, theme: event.target.checked ? 'dark' : 'light' })}
            />
            <Icon name="moon" size={15} />
            Dark theme
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.autoReview}
              onChange={(event) => onSettingsChange({ ...settings, autoReview: event.target.checked })}
            />
            <Icon name="zap" size={15} />
            Proactive diagram review
          </label>
          <button onClick={onTestConnection} disabled={isBusy}>
            <Icon name="plug" size={15} />
            Test Ollama
          </button>
          <p className="privacy-note">Local-only: prompts, images, chats, and diagrams are sent only to the configured Ollama endpoint.</p>
        </section>
      ) : (
        <>
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

          <footer className="composer">
            <div className="composer-options">
              <label className="thinking-control" title="Thinking level">
                <Icon name="brain" size={15} />
                <select
                  aria-label="Thinking level"
                  value={settings.thinkingLevel}
                  onChange={(event) => onSettingsChange({ ...settings, thinkingLevel: event.target.value as ThinkingLevel })}
                  disabled={isBusy}
                >
                  <option value="off">Off</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <Icon name="chevronDown" size={12} />
              </label>
              <button
                type="button"
                className="composer-clear-button clear-button"
                onClick={onClearChat}
                disabled={isBusy || messages.length === 0}
                aria-label="Clear chat"
                title="Clear chat"
              >
                <Icon name="trash" size={15} />
              </button>
            </div>

            <div className="composer-input-wrap">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Ask about the diagram, tradeoffs, scaling, security..."
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
                }}
              />
            </div>

            <div className="composer-action-row">
              <button
                type="button"
                onClick={() => onSettingsChange({ ...settings, autoReview: !settings.autoReview })}
                className={`input-corner-toggle ${settings.autoReview ? 'proactive-button' : 'manual-button'}`}
                aria-label={settings.autoReview ? 'Switch to manual review' : 'Switch to proactive review'}
                title={settings.autoReview ? 'Currently proactive. Click for manual.' : 'Currently manual. Click for proactive.'}
                disabled={isBusy}
              >
                <Icon name={settings.autoReview ? 'zap' : 'user'} size={14} />
                <span>{settings.autoReview ? 'Proactive' : 'Manual'}</span>
              </button>
              <button
                className={`send-button unified-action-button input-action-button ${prompt.trim() ? 'send-mode' : 'review-mode'}`}
                onClick={() => (prompt.trim() ? submit() : onReview())}
                disabled={isBusy}
                aria-label={prompt.trim() ? 'Send message' : 'Review diagram'}
              >
                <span className="action-icon-segment">
                  <Icon name={prompt.trim() ? 'send' : 'sparkles'} size={15} />
                </span>
                <span>{isBusy ? 'Thinking' : prompt.trim() ? 'Send' : 'Review'}</span>
              </button>
            </div>
          </footer>
        </>
      )}
    </aside>
  );
}
