import { AppTooltip } from '../AppTooltip';
import { Icon, type IconName } from './icons';

type AssistantHeaderToggleAction = {
  label: string;
  ariaLabel: string;
  tooltipLabel: string;
  iconName: IconName;
};

type AssistantHeaderProps = {
  status: string;
  toggleAction: AssistantHeaderToggleAction;
  onToggleView: () => void;
};

export function AssistantHeader({ status, toggleAction, onToggleView }: AssistantHeaderProps) {
  return (
    <header className="assistant-header">
      <div className="assistant-title">
        <span className="assistant-mark">
          <img className="logo-light" src="/logos/logo-light.svg" alt="" aria-hidden="true" />
          <img className="logo-dark" src="/logos/logo-dark.svg" alt="" aria-hidden="true" />
        </span>
        <div className="assistant-title-copy">
          <div className="assistant-heading-row">
            <h1>AI Agent</h1>
            <div className="assistant-header-actions">
              <AppTooltip label={toggleAction.tooltipLabel}>
                <button
                  type="button"
                  className="settings-toggle"
                  onClick={onToggleView}
                  aria-label={toggleAction.ariaLabel}
                >
                  <Icon name={toggleAction.iconName} size={15} />
                  <span>{toggleAction.label}</span>
                </button>
              </AppTooltip>
            </div>
          </div>
          <p>{status}</p>
        </div>
      </div>
    </header>
  );
}
