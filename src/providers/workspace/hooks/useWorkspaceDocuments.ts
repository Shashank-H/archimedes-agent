import { useCallback, useMemo, useRef, useState } from 'react';
import { appStorage } from '../../../lib/storage';
import { workspaceProviderFactory } from '../../../lib/workspace/factory';
import { UNTITLED_DOCUMENT_ID } from '../../../lib/workspace/untitled';
import type {
  WorkspaceEntry,
  WorkspaceFileId,
  WorkspaceRoot,
  WorkspaceSaveState,
  WorkspaceTab,
} from '../../../lib/workspace/types';
import type { DiagramSnapshot } from '../../../types';

function createUntitledTab(snapshot: DiagramSnapshot | null): WorkspaceTab {
  return {
    id: UNTITLED_DOCUMENT_ID,
    title: 'Untitled',
    path: 'Untitled',
    providerKind: 'untitled',
    rootId: 'untitled://local/root',
    isUntitled: true,
    isSupported: true,
    loadState: 'loaded',
    saveState: 'saved',
    error: null,
    snapshot,
  };
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useWorkspaceDocuments() {
  const initialSnapshot = useMemo(() => appStorage.loadScene(), []);
  const snapshotByTabIdRef = useRef(new Map<WorkspaceFileId, DiagramSnapshot | null>([[UNTITLED_DOCUMENT_ID, initialSnapshot]]));
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => [createUntitledTab(initialSnapshot)]);
  const [activeTabId, setActiveTabId] = useState<WorkspaceFileId>(UNTITLED_DOCUMENT_ID);
  const activeTabIdRef = useRef<WorkspaceFileId>(UNTITLED_DOCUMENT_ID);
  const persistTimerRef = useRef<number | undefined>(undefined);
  const dirtyStateTimerRef = useRef<number | undefined>(undefined);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;
  const activeSnapshot = activeTab ? snapshotByTabIdRef.current.get(activeTab.id) ?? null : null;
  const snapshotRef = useRef<DiagramSnapshot | null>(activeSnapshot);
  snapshotRef.current = activeSnapshot;

  const setActive = useCallback((tabId: WorkspaceFileId) => {
    activeTabIdRef.current = tabId;
    setActiveTabId(tabId);
  }, []);

  const getCurrentSnapshot = useCallback(() => {
    const currentTabId = activeTabIdRef.current;
    return snapshotByTabIdRef.current.get(currentTabId) ?? null;
  }, []);

  const handleSnapshotChange = useCallback((snapshot: DiagramSnapshot) => {
    const tabId = activeTabIdRef.current;
    snapshotByTabIdRef.current.set(tabId, snapshot);
    snapshotRef.current = snapshot;

    window.clearTimeout(dirtyStateTimerRef.current);
    dirtyStateTimerRef.current = window.setTimeout(() => {
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === tabId
            ? tab.saveState === 'dirty'
              ? tab
              : {
                  ...tab,
                  saveState: 'dirty',
                }
            : tab,
        ),
      );
    }, 0);

    if (tabId === UNTITLED_DOCUMENT_ID) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = window.setTimeout(() => appStorage.saveScene(snapshot), 600);
    }
  }, []);

  const openEntryAsTab = useCallback(async (entry: WorkspaceEntry) => {
    if (entry.kind === 'directory') return;

    if (snapshotByTabIdRef.current.has(entry.id)) {
      setActive(entry.id);
      return;
    }

    const loadingTab: WorkspaceTab = {
      id: entry.id,
      title: entry.name,
      path: entry.path,
      providerKind: entry.providerKind,
      rootId: entry.rootId,
      isUntitled: false,
      isSupported: entry.isSupported,
      loadState: 'loading',
      saveState: 'idle',
      error: null,
      snapshot: null,
    };

    setTabs((currentTabs) => [...currentTabs, loadingTab]);
    setActive(entry.id);

    try {
      const provider = workspaceProviderFactory.getProvider(entry.providerKind);
      const document = await provider.readDocument(entry);
      snapshotByTabIdRef.current.set(entry.id, document.snapshot);
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === entry.id
            ? {
                ...tab,
                title: document.title,
                path: document.path,
                isSupported: document.isSupported,
                loadState: 'loaded',
                saveState: 'saved',
                error: null,
                snapshot: document.snapshot,
              }
            : tab,
        ),
      );
    } catch (error) {
      setTabs((currentTabs) =>
        currentTabs.map((tab) =>
          tab.id === entry.id
            ? { ...tab, loadState: 'error', saveState: 'error', error: toErrorMessage(error) }
            : tab,
        ),
      );
    }
  }, [setActive]);

  const openUntitledTab = useCallback(() => setActive(UNTITLED_DOCUMENT_ID), [setActive]);

  const switchTab = useCallback((tabId: WorkspaceFileId) => setActive(tabId), [setActive]);

  const closeTab = useCallback((tabId: WorkspaceFileId) => {
    const tab = tabs.find((candidate) => candidate.id === tabId);
    if (tab?.saveState === 'dirty' && !window.confirm(`Close ${tab.title} without saving?`)) return;

    if (tabId === UNTITLED_DOCUMENT_ID) return;

    snapshotByTabIdRef.current.delete(tabId);
    setTabs((currentTabs) => {
      const nextTabs = currentTabs.filter((candidate) => candidate.id !== tabId);
      if (activeTabIdRef.current === tabId) {
        const nextActiveTab = nextTabs[Math.max(0, currentTabs.findIndex((candidate) => candidate.id === tabId) - 1)] ?? nextTabs[0];
        if (nextActiveTab) {
          activeTabIdRef.current = nextActiveTab.id;
          setActiveTabId(nextActiveTab.id);
        }
      }
      return nextTabs.length ? nextTabs : [createUntitledTab(appStorage.loadScene())];
    });
  }, [tabs]);

  const saveActiveTab = useCallback(async () => {
    const tabId = activeTabIdRef.current;
    const tab = tabs.find((candidate) => candidate.id === tabId);
    const snapshot = snapshotByTabIdRef.current.get(tabId);
    if (!tab || !snapshot || !tab.isSupported) return;

    setTabs((currentTabs) => currentTabs.map((candidate) => candidate.id === tabId ? { ...candidate, saveState: 'saving', error: null } : candidate));

    try {
      const provider = workspaceProviderFactory.getProvider(tab.providerKind);
      await provider.writeDocument({
        id: tab.id,
        providerKind: tab.providerKind,
        rootId: tab.rootId,
        title: tab.title,
        path: tab.path,
        snapshot,
        isUntitled: tab.isUntitled,
        isSupported: tab.isSupported,
      }, snapshot);
      setTabs((currentTabs) => currentTabs.map((candidate) => candidate.id === tabId ? { ...candidate, saveState: 'saved', error: null } : candidate));
    } catch (error) {
      setTabs((currentTabs) => currentTabs.map((candidate) => candidate.id === tabId ? { ...candidate, saveState: 'error', error: toErrorMessage(error) } : candidate));
    }
  }, [tabs]);

  const attachRootToEntries = useCallback((root: WorkspaceRoot, entries: WorkspaceEntry[]) => entries.map((entry) => ({ ...entry, rootId: root.id })), []);

  return {
    tabs,
    activeTab,
    activeTabId,
    activeSnapshot,
    snapshotRef,
    getCurrentSnapshot,
    handleSnapshotChange,
    openEntryAsTab,
    openUntitledTab,
    switchTab,
    closeTab,
    saveActiveTab,
    attachRootToEntries,
  };
}
