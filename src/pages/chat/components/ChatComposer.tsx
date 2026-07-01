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
  onSendChat: (prompt: string) => void;
  onReview: (prompt?: string) => void;
  onClearChat: () => void;
};

export function ChatComposer({ settings, messages, isBusy, onSettingsChange, onSendChat, onReview, onClearChat }: ChatComposerProps) {
  const { prompt, setPrompt, textareaRef, submit } = useChatComposer({ isBusy, onSendChat });

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
        <AppTooltip label="Clear chat">
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
          placeholder="Ask about the diagram, tradeoffs, scaling, security..."
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
          }}
        />
      </div>

      <div className="composer-action-row">
        <AppTooltip label={settings.autoReview ? 'Currently proactive. Click for manual.' : 'Currently manual. Click for proactive.'}>
          <button
            type="button"
            onClick={() => onSettingsChange({ ...settings, autoReview: !settings.autoReview })}
            className={`input-corner-toggle ${settings.autoReview ? 'proactive-button' : 'manual-button'}`}
            aria-label={settings.autoReview ? 'Switch to manual review' : 'Switch to proactive review'}
            disabled={isBusy}
          >
            <Icon name={settings.autoReview ? 'zap' : 'user'} size={14} />
            <span>{settings.autoReview ? 'Proactive' : 'Manual'}</span>
          </button>
        </AppTooltip>
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
  );
}
