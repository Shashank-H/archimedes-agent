import { useCallback, useEffect, useState } from 'react';
import { appStorage } from '../../../lib/storage';
import { nativeWorkspaceProvider } from '../../../lib/workspace/native';
import { workspaceProviderFactory } from '../../../lib/workspace/factory';
import type { NativeOpenWorkspacePathResult, WorkspaceEntry, WorkspaceFileId, WorkspaceOpenRootResult, WorkspaceRoot, WorkspaceRootId } from '../../../lib/workspace/types';

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

  const applyRootResult = useCallback((result: WorkspaceOpenRootResult) => {
    setRoot(result.root);
    setEntriesByParentId({ [result.root.id]: result.children });
    setExpandedEntryIds(new Set([result.root.id]));
    setSelectedEntryId(null);
  }, []);

  const saveRestorableRoot = useCallback((openedRoot: WorkspaceRoot) => {
    if (openedRoot.providerKind === 'native' || openedRoot.providerKind === 'browser') {
      appStorage.saveWorkspaceRoot({ providerKind: openedRoot.providerKind, path: openedRoot.path });
    }
  }, []);

  useEffect(() => {
    const storedRoot = appStorage.loadWorkspaceRoot();
    if (!storedRoot) return;

    const storedProviderKind = storedRoot.providerKind;
    const storedPath = storedRoot.path;
    const pathSegments = storedPath.split(/[\\/]/).filter(Boolean);
    const storedName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : storedPath;
    let didCancel = false;

    async function restoreWorkspaceRoot() {
      setIsOpeningRoot(true);
      setTreeError(null);
      try {
        const provider = workspaceProviderFactory.getProvider(storedProviderKind);
        if (!provider.restoreRoot) throw new Error('This workspace provider cannot restore folders.');
        const result = await provider.restoreRoot({
          id: `${storedProviderKind}://${storedPath}` as WorkspaceRootId,
          providerKind: storedProviderKind,
          name: storedName,
          path: storedPath,
        });
        if (didCancel) return;
        applyRootResult(result);
      } catch (error) {
        if (didCancel) return;
        appStorage.deleteWorkspaceRoot();
        setTreeError(`Could not restore the previous workspace folder: ${toErrorMessage(error)}`);
      } finally {
        if (!didCancel) setIsOpeningRoot(false);
      }
    }

    void restoreWorkspaceRoot();

    return () => {
      didCancel = true;
    };
  }, [applyRootResult]);

  const openWorkspaceRoot = useCallback(async () => {
    setIsOpeningRoot(true);
    setTreeError(null);
    try {
      const provider = workspaceProviderFactory.getDefaultProvider();
      const result = await provider.openRoot();
      applyRootResult(result);
      saveRestorableRoot(result.root);
    } catch (error) {
      setTreeError(toErrorMessage(error));
    } finally {
      setIsOpeningRoot(false);
    }
  }, [applyRootResult, saveRestorableRoot]);

  const openNativePath = useCallback(async (path: string): Promise<NativeOpenWorkspacePathResult | null> => {
    setIsOpeningRoot(true);
    setTreeError(null);
    try {
      const result = await nativeWorkspaceProvider.openPath(path);
      if (result.status !== 'opened' || !result.root) {
        setTreeError(result.message ?? `Could not open ${path}.`);
        return result;
      }

      applyRootResult({ root: result.root, children: result.children });
      saveRestorableRoot(result.root);
      if (result.targetEntry) {
        setSelectedEntryId(result.targetEntry.id);
      }
      return result;
    } catch (error) {
      setTreeError(toErrorMessage(error));
      return null;
    } finally {
      setIsOpeningRoot(false);
    }
  }, [applyRootResult, saveRestorableRoot]);

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
    openNativePath,
    refreshWorkspaceRoot,
    toggleDirectory,
  };
}
