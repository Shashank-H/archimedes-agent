import { AppTooltip } from '../../../components/AppTooltip';
import { Icon } from '../../../components/ui/icons';
import type { AppSettings } from '../../../types';
import type { WorkspaceRoot, WorkspaceTab } from '../../../lib/workspace/types';
import { workspaceProviderFactory } from '../../../lib/workspace/factory';
import { getWorkspacePlatformActions, getWorkspaceRuntime } from '../../../lib/workspace/platformActions';
import { canSaveWorkspaceTab } from '../../../providers/workspace/tabs/WorkspaceTabManagerContext';
import { useWorkspaceWindowControls } from '../hooks/useWorkspaceWindowControls';

type WorkspaceTopBarProps = {
  root: WorkspaceRoot | null;
  activeTab: WorkspaceTab | null;
  settings: AppSettings;
  assistantStatus: string;
  isAssistantBusy: boolean;
  isOpeningRoot: boolean;
  isExplorerCollapsed: boolean;
  isAssistantCollapsed: boolean;
  onToggleExplorer: () => void;
  onToggleAssistant: () => void;
  onOpenWorkspaceRoot: () => void | Promise<unknown>;
  onOpenUntitledTab: () => void;
  onSaveActiveTab: () => void | Promise<void>;
  onReview: () => void;
  onOpenSettings: () => void;
};

function saveStateText(activeTab: WorkspaceTab | null) {
  if (!activeTab) return 'No document open';
  if (activeTab.loadState === 'loading') return `Loading ${activeTab.title}…`;
  if (activeTab.loadState === 'error') return `Could not load ${activeTab.title}`;
  if (!activeTab.isSupported) return `Viewing unsupported file: ${activeTab.title}`;
  if (activeTab.saveState === 'dirty') return `Unsaved changes in ${activeTab.title}`;
  if (activeTab.saveState === 'saving') return `Saving ${activeTab.title}…`;
  if (activeTab.saveState === 'error') return activeTab.error ?? `Save failed for ${activeTab.title}`;
  return `Editing ${activeTab.title}`;
}

function activeBreadcrumb(root: WorkspaceRoot | null, activeTab: WorkspaceTab | null) {
  if (!activeTab) return root?.name ?? 'No workspace';
  const rootName = root?.name ?? (activeTab.isUntitled ? 'Untitled' : 'Workspace');
  const pathParts = activeTab.path.split(/[\\/]/).filter(Boolean);
  const compactPath = pathParts.length > 3 ? ['…', ...pathParts.slice(-3)] : pathParts;
  return [rootName, ...compactPath].join(' › ');
}

export function WorkspaceTopBar({
  root,
  activeTab,
  settings,
  assistantStatus,
  isAssistantBusy,
  isOpeningRoot,
  isExplorerCollapsed,
  isAssistantCollapsed,
  onToggleExplorer,
  onToggleAssistant,
  onOpenWorkspaceRoot,
  onOpenUntitledTab,
  onSaveActiveTab,
  onReview,
  onOpenSettings,
}: WorkspaceTopBarProps) {
  const runtime = getWorkspaceRuntime();
  const capabilities = workspaceProviderFactory.getProvider(root?.providerKind ?? workspaceProviderFactory.getDefaultProvider().kind).capabilities;
  const canSave = canSaveWorkspaceTab(activeTab);
  const canReview = Boolean(activeTab?.isSupported && activeTab.loadState === 'loaded');
  const actions = getWorkspacePlatformActions({
    runtime,
    providerKind: root?.providerKind ?? null,
    capabilities,
    hasRoot: Boolean(root),
    canSave,
    saveState: activeTab?.saveState,
    canReview,
    isAssistantBusy,
  });
  const openAction = actions.find((action) => action.id === 'open-folder');
  const saveAction = actions.find((action) => action.id === 'save');
  const reviewAction = actions.find((action) => action.id === 'review');
  const { controls: windowControls } = useWorkspaceWindowControls();

  return (
    <header className="workspace-top-bar" aria-label="Workspace summary" data-tauri-drag-region>
      <div className="workspace-top-left" data-tauri-drag-region>
        <button
          type="button"
          className="workspace-chrome-button"
          onClick={onToggleExplorer}
          aria-pressed={!isExplorerCollapsed}
          aria-label={isExplorerCollapsed ? 'Expand workspace explorer' : 'Collapse workspace explorer'}
          title={isExplorerCollapsed ? 'Expand explorer' : 'Collapse explorer'}
        >
          <Icon name="menu" size={15} />
        </button>
        <div className="workspace-brand" aria-label="Archimedes" data-tauri-drag-region>
          <span className="workspace-brand-mark">
            <img className="logo-light" src="/logos/logo-light.svg" alt="" aria-hidden="true" />
            <img className="logo-dark" src="/logos/logo-dark.svg" alt="" aria-hidden="true" />
          </span>
          <span>Archimedes</span>
        </div>
      </div>

      <div className="workspace-current-work" title={activeTab?.path ?? root?.path ?? 'No workspace'} data-tauri-drag-region>
        <span className="workspace-current-breadcrumb" data-tauri-drag-region>{activeBreadcrumb(root, activeTab)}</span>
        <span className={`workspace-current-state is-${activeTab?.saveState ?? 'idle'}`} data-tauri-drag-region>
          {isAssistantBusy ? assistantStatus : saveStateText(activeTab)}
        </span>
      </div>

      <div className="workspace-top-actions" aria-label="Workspace actions">
        {openAction?.visible ? (
          <button
            type="button"
            className="workspace-top-action"
            onClick={onOpenWorkspaceRoot}
            disabled={isOpeningRoot || !openAction.enabled}
            aria-label={openAction.ariaLabel}
            title={openAction.title}
          >
            {isOpeningRoot ? 'Opening…' : openAction.shortLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="workspace-top-action"
          onClick={onOpenUntitledTab}
          aria-label="Create a new untitled diagram"
          title="New untitled diagram"
        >
          New
        </button>
        {saveAction?.visible ? (
          <button
            type="button"
            className="workspace-top-action"
            onClick={onSaveActiveTab}
            disabled={!saveAction.enabled}
            aria-label={saveAction.ariaLabel}
            title={saveAction.title}
          >
            {saveAction.shortLabel}
          </button>
        ) : null}
        {reviewAction?.visible ? (
          <button
            type="button"
            className="workspace-top-action is-primary"
            onClick={onReview}
            disabled={!reviewAction.enabled}
            aria-label={reviewAction.ariaLabel}
            title={reviewAction.title}
          >
            {reviewAction.shortLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="workspace-chrome-button"
          onClick={onOpenSettings}
          aria-label="Open assistant settings"
          title="Settings"
        >
          <Icon name="settings" size={14} />
        </button>
        <button
          type="button"
          className="workspace-chrome-button"
          onClick={onToggleAssistant}
          aria-pressed={!isAssistantCollapsed}
          aria-label={isAssistantCollapsed ? 'Expand assistant panel' : 'Collapse assistant panel'}
          title={isAssistantCollapsed ? 'Expand assistant' : 'Collapse assistant'}
        >
          <Icon name={isAssistantCollapsed ? 'chevronLeft' : 'chevronRight'} size={14} />
        </button>
        <span className="workspace-provider-chip" title={`${settings.provider} · ${settings.model}`}>
          {settings.provider === 'ollama' ? 'Ollama' : 'OpenAI'}
        </span>
        {windowControls.length > 0 ? (
          <div className="workspace-window-controls" aria-label="Window controls">
            {windowControls.map((control) => (
              <AppTooltip key={control.id} label={control.label} side="bottom" align="center">
                <button
                  type="button"
                  className={`workspace-window-control${control.isDestructive ? ' is-destructive' : ''}`}
                  onClick={control.onClick}
                  aria-label={control.label}
                >
                  <Icon name={control.icon} size={13} />
                </button>
              </AppTooltip>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
