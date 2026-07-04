import type { CSSProperties, ReactNode } from 'react';
import { Icon, type IconName } from '../../../components/ui/icons';
import { getWorkspaceResourceKey, type WorkspaceEntry, type WorkspaceFileId, type WorkspaceRoot, type WorkspaceTab } from '../../../lib/workspace/types';

type WorkspaceTreeProps = {
  root: WorkspaceRoot;
  entriesByParentId: Record<string, WorkspaceEntry[]>;
  expandedEntryIds: Set<WorkspaceFileId>;
  selectedEntryId: WorkspaceFileId | null;
  tabs: WorkspaceTab[];
  onSelectEntry: (entry: WorkspaceEntry) => void;
};

function fileIcon(entry: WorkspaceEntry, isExpanded: boolean): IconName {
  if (entry.kind === 'directory') return isExpanded ? 'folderOpen' : 'folder';
  if (entry.isSupported) return 'diagram';
  if (entry.extension === '.json') return 'fileText';
  return 'unsupportedFile';
}

function EntryRow({
  entry,
  depth,
  isExpanded,
  isSelected,
  isOpen,
  isDirty,
  hasError,
  onSelectEntry,
}: {
  entry: WorkspaceEntry;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isOpen: boolean;
  isDirty: boolean;
  hasError: boolean;
  onSelectEntry: (entry: WorkspaceEntry) => void;
}) {
  const isDirectory = entry.kind === 'directory';
  const isUnsupportedFile = !entry.isSupported && entry.kind === 'file';
  const icon = fileIcon(entry, isExpanded);

  return (
    <button
      type="button"
      className={`workspace-tree-row${isSelected ? ' is-selected' : ''}${isOpen ? ' is-open' : ''}${isDirty ? ' is-dirty' : ''}${hasError ? ' is-error' : ''}${isUnsupportedFile ? ' is-unsupported' : ''}`}
      style={{ '--tree-depth': depth } as CSSProperties}
      onClick={() => onSelectEntry(entry)}
      title={entry.path}
      role="treeitem"
      aria-current={isSelected ? 'page' : undefined}
      aria-expanded={isDirectory ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-level={depth + 1}
    >
      <span className="workspace-tree-chevron" aria-hidden="true">
        {isDirectory ? <Icon name={isExpanded ? 'caretDown' : 'caretRight'} size={12} /> : null}
      </span>
      <span className={`workspace-tree-icon is-${icon}`} aria-hidden="true">
        <Icon name={icon} size={14} />
      </span>
      <span className="workspace-tree-name">{entry.name}</span>
      {hasError ? <span className="workspace-tree-pill is-error">error</span> : null}
      {isUnsupportedFile ? <span className="workspace-tree-pill">unsupported</span> : null}
      {isOpen ? <span className="workspace-tree-open" role="img" aria-label="Open tab" /> : null}
      {isDirty ? <span className="workspace-tree-dirty" role="img" aria-label="Unsaved changes" /> : null}
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
  const tabByResourceKey = new Map(tabs.map((tab) => [getWorkspaceResourceKey(tab), tab]));
  const dirtyTabKeys = new Set(tabs.filter((tab) => tab.saveState === 'dirty').map(getWorkspaceResourceKey));
  const openTabKeys = new Set(tabs.map(getWorkspaceResourceKey));

  const renderEntries = (parentId: WorkspaceFileId, depth: number): ReactNode => {
    const entries = entriesByParentId[parentId] ?? [];
    return entries.map((entry) => {
      const resourceKey = getWorkspaceResourceKey(entry);
      const matchingTab = tabByResourceKey.get(resourceKey);

      return (
        <div key={entry.id} role="none">
          <EntryRow
            entry={entry}
            depth={depth}
            isExpanded={expandedEntryIds.has(entry.id)}
            isSelected={selectedEntryId === entry.id}
            isOpen={openTabKeys.has(resourceKey)}
            isDirty={dirtyTabKeys.has(resourceKey)}
            hasError={matchingTab?.loadState === 'error' || matchingTab?.saveState === 'error'}
            onSelectEntry={onSelectEntry}
          />
          {entry.kind === 'directory' && expandedEntryIds.has(entry.id)
            ? renderEntries(entry.id, depth + 1)
            : null}
        </div>
      );
    });
  };

  return <div className="workspace-tree" role="tree" aria-label={`${root.name} files`}>{renderEntries(root.id, 0)}</div>;
}
