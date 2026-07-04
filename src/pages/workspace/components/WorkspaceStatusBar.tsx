import type { AppSettings, DiagramSnapshot } from '../../../types';
import type { WorkspaceRoot, WorkspaceTab } from '../../../lib/workspace/types';
import { getWorkspaceRuntime, getWorkspaceRuntimeLabel } from '../../../lib/workspace/platformActions';

type WorkspaceStatusBarProps = {
  root: WorkspaceRoot | null;
  activeTab: WorkspaceTab | null;
  activeSnapshot: DiagramSnapshot | null;
  settings: AppSettings;
  assistantStatus: string;
  isAssistantBusy: boolean;
};

function countLiveElements(snapshot: DiagramSnapshot | null) {
  return snapshot?.elements.filter((element) => !element.isDeleted).length ?? 0;
}

function saveStateLabel(activeTab: WorkspaceTab | null) {
  if (!activeTab) return 'No file';
  if (!activeTab.isSupported) return 'Unsupported';
  if (activeTab.loadState === 'loading') return 'Loading';
  if (activeTab.loadState === 'error') return 'Load failed';
  if (activeTab.saveState === 'dirty') return 'Unsaved changes';
  if (activeTab.saveState === 'saving') return 'Saving';
  if (activeTab.saveState === 'error') return 'Save failed';
  if (activeTab.isUntitled) return 'Saved locally';
  return 'Saved';
}

export function WorkspaceStatusBar({
  root,
  activeTab,
  activeSnapshot,
  settings,
  assistantStatus,
  isAssistantBusy,
}: WorkspaceStatusBarProps) {
  const runtime = getWorkspaceRuntime();
  const elementCount = countLiveElements(activeSnapshot);
  const providerLabel = root?.providerKind ?? activeTab?.providerKind ?? 'untitled';
  const rootLabel = root?.name ?? (activeTab?.isUntitled ? 'Untitled' : 'No folder');
  const fileLabel = activeTab?.title ?? 'No document';

  return (
    <footer className="workspace-status-bar" aria-label="Workspace status" role="status">
      <div className="workspace-status-group">
        <span title={getWorkspaceRuntimeLabel(runtime)}>{runtime}</span>
        <span title="Workspace provider">{providerLabel}</span>
        <span title={root?.path ?? rootLabel}>{rootLabel}</span>
        <span title={activeTab?.path ?? fileLabel}>{fileLabel}</span>
        <span className={`workspace-status-save is-${activeTab?.saveState ?? 'idle'}`} title={activeTab?.error ?? undefined}>
          {saveStateLabel(activeTab)}
        </span>
      </div>
      <div className="workspace-status-group is-right">
        <span title="Live Excalidraw element count">{elementCount} elements</span>
        <span title="Assistant status">{isAssistantBusy ? assistantStatus : 'Assistant ready'}</span>
        <span title={`${settings.provider} model`}>{settings.provider} · {settings.model}</span>
        <span title="Automatic diagram review">Auto review {settings.autoReview ? 'on' : 'off'}</span>
        <span title="Keyboard shortcut">Ctrl+S save</span>
      </div>
    </footer>
  );
}
