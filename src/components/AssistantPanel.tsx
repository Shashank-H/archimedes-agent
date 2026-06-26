import { useState } from 'react';
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

  const submit = () => {
    const value = prompt.trim();
    if (!value || isBusy) return;
    onSendChat(value);
    setPrompt('');
  };

  return (
    <aside className="assistant-panel">
      <header className="assistant-header">
        <div>
          <h1>Brainstorm Gemma</h1>
          <p>{status}</p>
        </div>
        <button
          className="settings-toggle"
          onClick={() => setShowSettings((value) => !value)}
          aria-label={showSettings ? 'Back to chat' : 'Open settings'}
          title={showSettings ? 'Back to chat' : 'Settings'}
        >
          {showSettings ? '💬' : '⚙'}
        </button>
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
            Dark theme
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.autoReview}
              onChange={(event) => onSettingsChange({ ...settings, autoReview: event.target.checked })}
            />
            Send diagram image every 20s
          </label>
          <button onClick={onTestConnection} disabled={isBusy}>Test Ollama</button>
          <p className="privacy-note">Local-only: prompts, images, chats, and diagrams are sent only to the configured Ollama endpoint.</p>
        </section>
      ) : (
        <>
          <div className="assistant-actions">
            <button onClick={() => onReview()} disabled={isBusy}>Review diagram</button>
            <button
              onClick={() => onSettingsChange({ ...settings, autoReview: !settings.autoReview })}
              className={`icon-button ${settings.autoReview ? 'pause-button' : 'resume-button'}`}
              aria-label={settings.autoReview ? 'Pause auto-send' : 'Resume auto-send'}
              title={settings.autoReview ? 'Pause auto-send' : 'Resume auto-send'}
            >
              {settings.autoReview ? '⏸' : '▶'}
            </button>
            <button onClick={onClearChat} disabled={isBusy || messages.length === 0}>Clear chat</button>
          </div>

          <div className="message-list">
            {messages.length === 0 ? (
              <div className="empty-state">
                Draw a system design, then click <strong>Review diagram</strong>. Auto-send reviews the diagram image every 20 seconds unless paused.
              </div>
            ) : (
              messages.map((message) => (
                <article key={message.id} className={`message ${message.role} ${message.kind ?? ''}`}>
                  <div className="message-meta">
                    <span>{message.role === 'assistant' ? 'Gemma' : message.role}</span>
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
              <label>
                Thinking
                <select
                  value={settings.thinkingLevel}
                  onChange={(event) => onSettingsChange({ ...settings, thinkingLevel: event.target.value as ThinkingLevel })}
                  disabled={isBusy}
                >
                  <option value="off">Off</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
            </div>
            <textarea
              placeholder="Ask about the diagram, tradeoffs, scaling, security..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
              }}
            />
            <button onClick={submit} disabled={isBusy || !prompt.trim()}>{isBusy ? 'Thinking...' : 'Send'}</button>
          </footer>
        </>
      )}
    </aside>
  );
}
