import { Icon } from '../../../components/ui/icons';

type WorkspaceActivityRailProps = {
  isExplorerCollapsed: boolean;
  isAssistantCollapsed: boolean;
  onToggleExplorer: () => void;
  onToggleAssistant: () => void;
  onNewLocalDraft: () => void;
  onOpenSettings: () => void;
};

export function WorkspaceActivityRail({
  isExplorerCollapsed,
  isAssistantCollapsed,
  onToggleExplorer,
  onToggleAssistant,
  onNewLocalDraft,
  onOpenSettings,
}: WorkspaceActivityRailProps) {
  return (
    <nav className="workspace-activity-rail" aria-label="Archimedes workspace views">
      <div className="workspace-activity-primary">
        <button
          type="button"
          className={`workspace-activity-button${!isExplorerCollapsed ? ' is-active' : ''}`}
          onClick={onToggleExplorer}
          aria-pressed={!isExplorerCollapsed}
          aria-label={isExplorerCollapsed ? 'Show explorer' : 'Hide explorer'}
          title={isExplorerCollapsed ? 'Show explorer' : 'Hide explorer'}
        >
          <Icon name="explorer" size={21} />
        </button>
        <button
          type="button"
          className="workspace-activity-button"
          onClick={onNewLocalDraft}
          aria-label="Create untitled diagram"
          title="New untitled diagram"
        >
          <Icon name="draft" size={21} />
        </button>
        <button
          type="button"
          className={`workspace-activity-button${!isAssistantCollapsed ? ' is-active' : ''}`}
          onClick={onToggleAssistant}
          aria-pressed={!isAssistantCollapsed}
          aria-label={isAssistantCollapsed ? 'Show AI Agent' : 'Hide AI Agent'}
          title={isAssistantCollapsed ? 'Show AI Agent' : 'Hide AI Agent'}
        >
          <Icon name="message" size={21} />
        </button>
      </div>
      <div className="workspace-activity-secondary">
        <button
          type="button"
          className="workspace-activity-button"
          onClick={onOpenSettings}
          aria-label="Open Archimedes settings"
          title="Settings"
        >
          <Icon name="settings" size={21} />
        </button>
      </div>
    </nav>
  );
}
