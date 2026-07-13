import { AppTooltip } from '../../../components/AppTooltip';
import { CustomSelect } from '../../../components/CustomSelect';
import { Icon } from '../../../components/ui/icons';
import type { AppSettings, ChatMessage, ThinkingLevel } from '../../../types';
import { THINKING_OPTIONS } from '../constants';
import { useChatComposer } from './hooks/useChatComposer';

type ChatComposerProps = {
  settings: AppSettings;
  messages: ChatMessage[];
  isBusy: boolean;
  onSettingsChange: (settings: AppSettings) => void;
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
  onClearChat: () => void;
};

export function ChatComposer({ settings, messages, isBusy, onSettingsChange, onSubmit, onCancel, onClearChat }: ChatComposerProps) {
  const { prompt, setPrompt, textareaRef, submit } = useChatComposer({ isBusy, onSendChat: onSubmit });

  return (
    <footer className="composer">
      <div className="composer-options">
        <AppTooltip label="Thinking level">
          <div className="thinking-control">
            <Icon name="brain" size={15} />
            <CustomSelect
              ariaLabel="Thinking level"
              value={settings.thinkingLevel}
              options={THINKING_OPTIONS}
              onChange={(value) => onSettingsChange({ ...settings, thinkingLevel: value as ThinkingLevel })}
              disabled={isBusy}
              className="thinking-select"
            />
          </div>
        </AppTooltip>
        <AppTooltip label={settings.autoReview ? 'Turn off proactive diagram reviews' : 'Turn on proactive diagram reviews'}>
          <button
            type="button"
            onClick={() => onSettingsChange({ ...settings, autoReview: !settings.autoReview })}
            className={`input-corner-toggle ${settings.autoReview ? 'proactive-button' : 'manual-button'}`}
            aria-label={settings.autoReview ? 'Disable proactive review' : 'Enable proactive review'}
            aria-pressed={settings.autoReview}
            disabled={isBusy}
          >
            <Icon name="zap" size={14} />
            <span>{settings.autoReview ? 'Proactive on' : 'Proactive off'}</span>
          </button>
        </AppTooltip>
        <AppTooltip label="Clear all assistant messages">
          <button
            type="button"
            className="composer-clear-button clear-button"
            onClick={onClearChat}
            disabled={isBusy || messages.length === 0}
            aria-label="Clear chat"
          >
            <Icon name="trash" size={15} />
          </button>
        </AppTooltip>
      </div>

      <div className="composer-input-wrap">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Ask a question, review the design, or describe what to change..."
          value={prompt}
          disabled={isBusy}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
          }}
        />
      </div>

      <div className="composer-action-row">
        <span className="composer-routing-hint">Automatically routed by LangGraph</span>
        <button
          className={`send-button unified-action-button input-action-button ${isBusy ? 'cancel-mode' : 'send-mode'}`}
          onClick={() => isBusy ? onCancel() : submit()}
          disabled={!isBusy && !prompt.trim()}
          aria-label={isBusy ? 'Cancel request' : 'Send to Archimedes'}
        >
          <span className="action-icon-segment"><Icon name={isBusy ? 'x' : 'send'} size={15} /></span>
          <span>{isBusy ? 'Cancel' : 'Send'}</span>
        </button>
      </div>
    </footer>
  );
}
