import { AppTooltip } from '../../../components/AppTooltip';
import { CustomSelect } from '../../../components/CustomSelect';
import { Icon } from '../../../components/ui/icons';
import type { AppSettings, ChatMessage, ThinkingLevel } from '../../../types';
import { THINKING_OPTIONS, type ChatSectionTab } from '../constants';
import { useChatComposer } from './hooks/useChatComposer';

type ChatComposerProps = {
  settings: AppSettings;
  messages: ChatMessage[];
  isBusy: boolean;
  onSettingsChange: (settings: AppSettings) => void;
  onSendChat: (prompt: string) => void;
  onReview: (prompt?: string) => void;
  onCancel: () => void;
  onClearChat: () => void;
  mode: ChatSectionTab;
};

export function ChatComposer({ settings, messages, isBusy, onSettingsChange, onSendChat, onReview, onCancel, onClearChat, mode }: ChatComposerProps) {
  const { prompt, setPrompt, textareaRef, submit } = useChatComposer({ isBusy, onSendChat });
  const isEditMode = mode === 'edit';

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
          placeholder={isEditMode ? 'Describe what to build or change on the active diagram...' : mode === 'chat' ? 'Ask about the diagram, tradeoffs, scaling, security...' : 'Add review focus, or leave empty for a full review...'}
          value={prompt}
          disabled={isBusy}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
          }}
        />
      </div>

      <div className="composer-action-row">
        {mode === 'review' && (
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
        )}
        <button
          className={`send-button unified-action-button input-action-button ${isBusy ? 'cancel-mode' : prompt.trim() ? 'send-mode' : 'review-mode'}`}
          onClick={() => isBusy ? onCancel() : mode === 'review' && !prompt.trim() ? onReview() : submit()}
          disabled={!isBusy && (isEditMode || mode === 'chat') && !prompt.trim()}
          aria-label={isBusy ? 'Cancel request' : isEditMode ? 'Run agentic diagram edit' : mode === 'review' ? 'Review diagram' : 'Send message'}
        >
          <span className="action-icon-segment">
            <Icon name={isBusy ? 'x' : isEditMode ? 'sparkles' : prompt.trim() ? 'send' : 'sparkles'} size={15} />
          </span>
          <span>{isBusy ? 'Cancel' : isEditMode ? 'Build' : mode === 'review' && !prompt.trim() ? 'Review' : 'Send'}</span>
        </button>
      </div>
    </footer>
  );
}
