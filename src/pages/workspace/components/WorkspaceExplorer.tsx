import { useWorkspace } from '../../../providers/workspace/WorkspaceContext';
import { useWorkspaceTabManager } from '../../../providers/workspace/tabs/WorkspaceTabManagerContext';
import { WorkspaceTree } from './WorkspaceTree';

export function WorkspaceExplorer() {
  const {
    root,
    entriesByParentId,
    expandedEntryIds,
    selectedEntryId,
    isOpeningRoot,
    treeError,
    openWorkspaceRoot,
    refreshWorkspaceRoot,
    selectEntry,
  } = useWorkspace();
  const { tabs, openUntitledTab } = useWorkspaceTabManager();

  return (
    <aside className="workspace-explorer" aria-label="Workspace explorer">
      <header className="workspace-explorer-header">
        <div>
          <p className="workspace-eyebrow">Workspace</p>
          <h2>{root?.name ?? 'No folder'}</h2>
        </div>
        <div className="workspace-explorer-actions">
          <button type="button" onClick={openWorkspaceRoot} disabled={isOpeningRoot}>
            {isOpeningRoot ? 'Opening…' : 'Open'}
          </button>
          <button type="button" onClick={refreshWorkspaceRoot} disabled={!root}>
            Refresh
          </button>
        </div>
      </header>

      {treeError ? <div className="workspace-error">{treeError}</div> : null}

      {root ? (
        <WorkspaceTree
          root={root}
          entriesByParentId={entriesByParentId}
          expandedEntryIds={expandedEntryIds}
          selectedEntryId={selectedEntryId}
          tabs={tabs}
          onSelectEntry={(entry) => void selectEntry(entry)}
        />
      ) : (
        <div className="workspace-empty">
          <p>Open a folder to browse Excalidraw diagrams.</p>
          <button type="button" onClick={openWorkspaceRoot} disabled={isOpeningRoot}>
            Open folder
          </button>
        </div>
      )}

      <footer className="workspace-explorer-footer">
        <button type="button" onClick={openUntitledTab}>New local draft</button>
      </footer>
    </aside>
  );
}
