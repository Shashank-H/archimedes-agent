import { useCallback, useState } from 'react';
import { workspaceProviderFactory } from '../../../lib/workspace/factory';
import type { WorkspaceEntry, WorkspaceFileId, WorkspaceRoot } from '../../../lib/workspace/types';

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useWorkspaceTree() {
  const [root, setRoot] = useState<WorkspaceRoot | null>(null);
  const [entriesByParentId, setEntriesByParentId] = useState<Record<string, WorkspaceEntry[]>>({});
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<WorkspaceFileId>>(new Set());
  const [selectedEntryId, setSelectedEntryId] = useState<WorkspaceFileId | null>(null);
  const [isOpeningRoot, setIsOpeningRoot] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  const openWorkspaceRoot = useCallback(async () => {
    setIsOpeningRoot(true);
    setTreeError(null);
    try {
      const provider = workspaceProviderFactory.getDefaultProvider();
      const result = await provider.openRoot();
      setRoot(result.root);
      setEntriesByParentId({ [result.root.id]: result.children });
      setExpandedEntryIds(new Set([result.root.id]));
    } catch (error) {
      setTreeError(toErrorMessage(error));
    } finally {
      setIsOpeningRoot(false);
    }
  }, []);

  const refreshWorkspaceRoot = useCallback(async () => {
    if (!root) return;
    setTreeError(null);
    try {
      const provider = workspaceProviderFactory.getProvider(root.providerKind);
      const children = await provider.listChildren(root, root.id);
      setEntriesByParentId((current) => ({ ...current, [root.id]: children }));
    } catch (error) {
      setTreeError(toErrorMessage(error));
    }
  }, [root]);

  const toggleDirectory = useCallback(async (entry: WorkspaceEntry) => {
    if (entry.kind !== 'directory' || !root) return;

    if (expandedEntryIds.has(entry.id)) {
      setExpandedEntryIds((current) => {
        const next = new Set(current);
        next.delete(entry.id);
        return next;
      });
      return;
    }

    setTreeError(null);
    try {
      const provider = workspaceProviderFactory.getProvider(entry.providerKind);
      const children = await provider.listChildren(root, entry.id);
      setEntriesByParentId((current) => ({ ...current, [entry.id]: children }));
      setExpandedEntryIds((current) => new Set(current).add(entry.id));
    } catch (error) {
      setTreeError(toErrorMessage(error));
    }
  }, [expandedEntryIds, root]);

  return {
    root,
    entriesByParentId,
    expandedEntryIds,
    selectedEntryId,
    isOpeningRoot,
    treeError,
    setSelectedEntryId,
    openWorkspaceRoot,
    refreshWorkspaceRoot,
    toggleDirectory,
  };
}
