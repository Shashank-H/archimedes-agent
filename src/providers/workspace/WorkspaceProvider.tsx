import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import type { WorkspaceEntry } from '../../lib/workspace/types';
import type { ExcalidrawApi } from '../../types';
import { GlobalShortcutsProvider } from '../shortcuts/GlobalShortcutsProvider';
import { WorkspaceContext } from './WorkspaceContext';
import { useWorkspaceSettings } from './hooks/useWorkspaceSettings';
import { useWorkspaceTree } from './hooks/useWorkspaceTree';
import { WorkspaceTabManagerProvider, useWorkspaceTabManager } from './tabs/WorkspaceTabManagerContext';

function WorkspaceContextProvider({ children }: { children: ReactNode }) {
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const { settings, handleSettingsChange } = useWorkspaceSettings();
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

  useEffect(() => {
    setWorkspaceSaveTarget({
      root: tree.root,
      onWorkspaceFileCreated: async (entry) => {
        await tree.refreshWorkspaceRoot();
        tree.setSelectedEntryId(entry.id);
      },
    });
  }, [setWorkspaceSaveTarget, tree]);

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
        openWorkspaceRoot: tree.openWorkspaceRoot,
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
