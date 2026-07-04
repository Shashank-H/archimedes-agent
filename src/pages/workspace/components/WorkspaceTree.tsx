import type { CSSProperties, ReactNode } from 'react';
import { getWorkspaceResourceKey, type WorkspaceEntry, type WorkspaceFileId, type WorkspaceRoot, type WorkspaceTab } from '../../../lib/workspace/types';

type WorkspaceTreeProps = {
  root: WorkspaceRoot;
  entriesByParentId: Record<string, WorkspaceEntry[]>;
  expandedEntryIds: Set<WorkspaceFileId>;
  selectedEntryId: WorkspaceFileId | null;
  tabs: WorkspaceTab[];
  onSelectEntry: (entry: WorkspaceEntry) => void;
};

function EntryRow({
  entry,
  depth,
  isExpanded,
  isSelected,
  isOpen,
  isDirty,
  onSelectEntry,
}: {
  entry: WorkspaceEntry;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isOpen: boolean;
  isDirty: boolean;
  onSelectEntry: (entry: WorkspaceEntry) => void;
}) {
  const icon = entry.kind === 'directory' ? (isExpanded ? '▾' : '▸') : entry.isSupported ? '◇' : '·';

  return (
    <button
      type="button"
      className={`workspace-tree-row${isSelected ? ' is-selected' : ''}${!entry.isSupported && entry.kind === 'file' ? ' is-muted' : ''}`}
      style={{ '--tree-depth': depth } as CSSProperties}
      onClick={() => onSelectEntry(entry)}
      title={entry.path}
    >
      <span className="workspace-tree-icon" aria-hidden="true">{icon}</span>
      <span className="workspace-tree-name">{entry.name}</span>
      {isOpen ? <span className="workspace-tree-pill">open</span> : null}
      {isDirty ? <span className="workspace-tree-dirty" aria-label="Unsaved changes" /> : null}
    </button>
  );
}

export function WorkspaceTree({
  root,
  entriesByParentId,
  expandedEntryIds,
  selectedEntryId,
  tabs,
  onSelectEntry,
}: WorkspaceTreeProps) {
  const dirtyTabKeys = new Set(tabs.filter((tab) => tab.saveState === 'dirty').map(getWorkspaceResourceKey));
  const openTabKeys = new Set(tabs.map(getWorkspaceResourceKey));

  const renderEntries = (parentId: WorkspaceFileId, depth: number): ReactNode => {
    const entries = entriesByParentId[parentId] ?? [];
    return entries.map((entry) => (
      <div key={entry.id}>
        <EntryRow
          entry={entry}
          depth={depth}
          isExpanded={expandedEntryIds.has(entry.id)}
          isSelected={selectedEntryId === entry.id}
          isOpen={openTabKeys.has(getWorkspaceResourceKey(entry))}
          isDirty={dirtyTabKeys.has(getWorkspaceResourceKey(entry))}
          onSelectEntry={onSelectEntry}
        />
        {entry.kind === 'directory' && expandedEntryIds.has(entry.id)
          ? renderEntries(entry.id, depth + 1)
          : null}
      </div>
    ));
  };

  return <div className="workspace-tree">{renderEntries(root.id, 0)}</div>;
}
