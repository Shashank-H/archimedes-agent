import type { WorkspaceTab } from '../../../lib/workspace/types';

type WorkspaceToolbarProps = {
  activeTab: WorkspaceTab | null;
  onSave: () => void;
};

function statusText(activeTab: WorkspaceTab | null) {
  if (!activeTab) return 'No document';
  if (!activeTab.isSupported) return 'Unsupported file';
  if (activeTab.loadState === 'loading') return 'Loading…';
  if (activeTab.loadState === 'error') return 'Load failed';
  if (activeTab.saveState === 'dirty') return 'Unsaved changes';
  if (activeTab.saveState === 'saving') return 'Saving…';
  if (activeTab.saveState === 'saved') return 'Saved';
  if (activeTab.saveState === 'error') return 'Save failed';
  return 'Ready';
}

export function WorkspaceToolbar({ activeTab, onSave }: WorkspaceToolbarProps) {
  const canSave = Boolean(activeTab?.isSupported && activeTab.saveState !== 'saving' && activeTab.loadState === 'loaded');

  return (
    <div className="workspace-toolbar">
      <div className="workspace-toolbar-title">
        <strong>{activeTab?.title ?? 'No document'}</strong>
        <span>{activeTab?.path ?? 'Open a diagram to start editing'}</span>
      </div>
      <div className="workspace-toolbar-actions">
        <span className={`workspace-save-state is-${activeTab?.saveState ?? 'idle'}`}>{statusText(activeTab)}</span>
        <button type="button" onClick={onSave} disabled={!canSave}>Save</button>
      </div>
    </div>
  );
}
