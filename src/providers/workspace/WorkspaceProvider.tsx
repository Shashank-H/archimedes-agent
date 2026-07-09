import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { nativeWorkspaceProvider } from '../../lib/workspace/native';
import { isSupportedDiagramPath } from '../../lib/workspace/types';
import type { WorkspaceEntry, WorkspaceRoot } from '../../lib/workspace/types';
import type { ExcalidrawApi } from '../../types';
import { GlobalShortcutsProvider } from '../shortcuts/GlobalShortcutsProvider';
import { WorkspaceContext } from './WorkspaceContext';
import { useWorkspaceSettings } from './hooks/useWorkspaceSettings';
import { useWorkspaceTree } from './hooks/useWorkspaceTree';
import { WorkspaceTabManagerProvider, useWorkspaceTabManager } from './tabs/WorkspaceTabManagerContext';

type NativeOpenRequestedPayload = {
  paths: string[];
};

function isTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function pathIsInsideRoot(path: string, rootPath: string) {
  const normalizedPath = normalizePath(path);
  const normalizedRootPath = normalizePath(rootPath);
  return normalizedPath === normalizedRootPath || normalizedPath.startsWith(`${normalizedRootPath}/`);
}

function basename(path: string) {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path;
}

function extensionFor(path: string) {
  const match = basename(path).match(/(\.excalidraw\.json|\.[^.]+)$/i);
  return match?.[1];
}

function entryForPathInRoot(path: string, root: WorkspaceRoot): WorkspaceEntry {
  return {
    id: `native://${path}` as WorkspaceEntry['id'],
    rootId: root.id,
    providerKind: 'native',
    kind: 'file',
    name: basename(path),
    path,
    parentId: null,
    extension: extensionFor(path),
    isSupported: isSupportedDiagramPath(path),
  };
}

function WorkspaceContextProvider({ children }: { children: ReactNode }) {
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const { settings, handleSettingsChange, effectiveTheme } = useWorkspaceSettings();
  const tree = useWorkspaceTree();
  const { openEntryAsTab, setWorkspaceSaveTarget } = useWorkspaceTabManager();

  const setDiagramApi = useCallback((api: ExcalidrawApi) => {
    apiRef.current = api;
  }, []);

  const selectEntry = useCallback(async (entry: WorkspaceEntry) => {
    tree.setSelectedEntryId(entry.id);
    if (entry.kind === 'directory') {
      await tree.toggleDirectory(entry);
      return;
    }
    await openEntryAsTab(entry);
  }, [openEntryAsTab, tree]);

  const openNativePaths = useCallback(async (paths: string[]) => {
    for (const path of paths) {
      if (tree.root?.providerKind === 'native' && pathIsInsideRoot(path, tree.root.path)) {
        const entry = entryForPathInRoot(path, tree.root);
        tree.setSelectedEntryId(entry.id);
        if (entry.isSupported) {
          await openEntryAsTab(entry);
        }
        continue;
      }

      const result = await tree.openNativePath(path);
      if (result?.status === 'opened' && result.targetEntry) {
        await openEntryAsTab(result.targetEntry);
      }
    }
  }, [openEntryAsTab, tree]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let didCancel = false;

    async function openPendingNativePaths() {
      try {
        const paths = await nativeWorkspaceProvider.takeNativeOpenRequests();
        if (!didCancel && paths.length > 0) {
          await openNativePaths(paths);
        }
      } catch (error) {
        console.error('Could not read native open requests', error);
      }
    }

    void openPendingNativePaths();

    const unlistenPromise = listen<NativeOpenRequestedPayload>('native-open-requested', (event) => {
      void openNativePaths(event.payload.paths)
        .then(() => nativeWorkspaceProvider.takeNativeOpenRequests())
        .catch((error) => console.error('Could not handle native open request', error));
    });

    return () => {
      didCancel = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [openNativePaths]);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    void nativeWorkspaceProvider
      .registerWindowWorkspaceRoot(tree.root?.providerKind === 'native' ? tree.root.path : null)
      .catch((error) => console.error('Could not register window workspace root', error));
  }, [tree.root]);

  useEffect(() => {
    setWorkspaceSaveTarget({
      root: tree.root,
      onWorkspaceFileCreated: async (entry) => {
        await tree.refreshWorkspaceRoot();
        tree.setSelectedEntryId(entry.id);
      },
    });
  }, [setWorkspaceSaveTarget, tree]);

  const openWorkspaceRoot = useCallback(() => (
    tree.openWorkspaceRoot({ openInNewNativeWindow: false })
  ), [tree]);

  return (
    <WorkspaceContext.Provider
      value={{
        settings,
        root: tree.root,
        entriesByParentId: tree.entriesByParentId,
        expandedEntryIds: tree.expandedEntryIds,
        selectedEntryId: tree.selectedEntryId,
        isOpeningRoot: tree.isOpeningRoot,
        treeError: tree.treeError,
        setDiagramApi,
        handleSettingsChange,
        effectiveTheme,
        openWorkspaceRoot,
        refreshWorkspaceRoot: tree.refreshWorkspaceRoot,
        toggleDirectory: tree.toggleDirectory,
        selectEntry,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  return (
    <WorkspaceTabManagerProvider>
      <GlobalShortcutsProvider>
        <WorkspaceContextProvider>{children}</WorkspaceContextProvider>
      </GlobalShortcutsProvider>
    </WorkspaceTabManagerProvider>
  );
}
