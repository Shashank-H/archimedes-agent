import { useCallback, useRef, type ReactNode } from 'react';
import type { WorkspaceEntry } from '../../lib/workspace/types';
import type { ExcalidrawApi } from '../../types';
import { WorkspaceContext } from './WorkspaceContext';
import { useWorkspaceDocuments } from './hooks/useWorkspaceDocuments';
import { useWorkspaceSettings } from './hooks/useWorkspaceSettings';
import { useWorkspaceTree } from './hooks/useWorkspaceTree';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const { settings, handleSettingsChange } = useWorkspaceSettings();
  const tree = useWorkspaceTree();
  const documents = useWorkspaceDocuments();

  const setDiagramApi = useCallback((api: ExcalidrawApi) => {
    apiRef.current = api;
  }, []);

  const selectEntry = useCallback(async (entry: WorkspaceEntry) => {
    tree.setSelectedEntryId(entry.id);
    if (entry.kind === 'directory') {
      await tree.toggleDirectory(entry);
      return;
    }
    await documents.openEntryAsTab(entry);
  }, [documents, tree]);

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
        tabs: documents.tabs,
        activeTab: documents.activeTab,
        activeTabId: documents.activeTabId,
        activeSnapshot: documents.activeSnapshot,
        initialSnapshot: documents.activeSnapshot,
        snapshotRef: documents.snapshotRef,
        setDiagramApi,
        getCurrentSnapshot: documents.getCurrentSnapshot,
        handleSnapshotChange: documents.handleSnapshotChange,
        handleSettingsChange,
        openWorkspaceRoot: tree.openWorkspaceRoot,
        refreshWorkspaceRoot: tree.refreshWorkspaceRoot,
        toggleDirectory: tree.toggleDirectory,
        selectEntry,
        openUntitledTab: documents.openUntitledTab,
        switchTab: documents.switchTab,
        closeTab: documents.closeTab,
        saveActiveTab: documents.saveActiveTab,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
