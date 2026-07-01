import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { serializeExcalidrawFile } from '../../../lib/excalidrawFile';
import { appStorage } from '../../../lib/storage';
import { workspaceProviderFactory } from '../../../lib/workspace/factory';
import type {
  WorkspaceEntry,
  WorkspaceFileId,
  WorkspaceSaveState,
  WorkspaceTab,
} from '../../../lib/workspace/types';
import { UNTITLED_DOCUMENT_ID } from '../../../lib/workspace/untitled';
import type { DiagramSnapshot } from '../../../types';

type WorkspaceDocumentRecord = {
  snapshot: DiagramSnapshot | null;
  savedFingerprint: string | null;
};

type WorkspaceTabManagerContextValue = {
  tabs: WorkspaceTab[];
  activeTab: WorkspaceTab | null;
  activeTabId: WorkspaceFileId | null;
  activeSnapshot: DiagramSnapshot | null;
  snapshotRef: RefObject<DiagramSnapshot | null>;
  getCurrentSnapshot: () => DiagramSnapshot | null;
  handleSnapshotChange: (snapshot: DiagramSnapshot) => void;
  openEntryAsTab: (entry: WorkspaceEntry) => Promise<void>;
  openUntitledTab: () => void;
  switchTab: (tabId: WorkspaceFileId) => void;
  closeTab: (tabId: WorkspaceFileId) => void;
  saveActiveTab: () => Promise<void>;
};

const UNTITLED_ROOT_ID = 'untitled://local/root';
const UNTITLED_TAB_TITLE = 'Untitled';
const UNTITLED_TAB_PATH = 'Untitled';
const UNTITLED_AUTOSAVE_DELAY_MS = 600;

function createUntitledTab(): WorkspaceTab {
  return {
    id: UNTITLED_DOCUMENT_ID,
    title: UNTITLED_TAB_TITLE,
    path: UNTITLED_TAB_PATH,
    providerKind: 'untitled',
    rootId: UNTITLED_ROOT_ID,
    isUntitled: true,
    isSupported: true,
    loadState: 'loaded',
    saveState: 'saved',
    error: null,
  };
}

function createLoadingTab(entry: WorkspaceEntry): WorkspaceTab {
  return {
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
  };
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createSnapshotFingerprint(snapshot: DiagramSnapshot | null) {
  return snapshot ? serializeExcalidrawFile(snapshot) : null;
}

function createDocumentRecord(snapshot: DiagramSnapshot | null): WorkspaceDocumentRecord {
  return {
    snapshot,
    savedFingerprint: createSnapshotFingerprint(snapshot),
  };
}

function resolveSnapshotSaveState(snapshot: DiagramSnapshot | null, savedFingerprint: string | null): WorkspaceSaveState {
  return createSnapshotFingerprint(snapshot) === savedFingerprint ? 'saved' : 'dirty';
}

const WorkspaceTabManagerContext = createContext<WorkspaceTabManagerContextValue | null>(null);

export function WorkspaceTabManagerProvider({ children }: { children: ReactNode }) {
  const initialUntitledSnapshot = useMemo(() => appStorage.loadScene(), []);
  const documentRecordByTabIdRef = useRef(
    new Map<WorkspaceFileId, WorkspaceDocumentRecord>([
      [UNTITLED_DOCUMENT_ID, createDocumentRecord(initialUntitledSnapshot)],
    ]),
  );
  const [tabs, setTabs] = useState<WorkspaceTab[]>(() => [createUntitledTab()]);
  const tabsRef = useRef<WorkspaceTab[]>(tabs);
  tabsRef.current = tabs;
  const [activeTabId, setActiveTabId] = useState<WorkspaceFileId>(UNTITLED_DOCUMENT_ID);
  const activeTabIdRef = useRef<WorkspaceFileId>(UNTITLED_DOCUMENT_ID);
  const persistTimerRef = useRef<number | undefined>(undefined);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;
  const activeSnapshot = activeTab ? documentRecordByTabIdRef.current.get(activeTab.id)?.snapshot ?? null : null;
  const snapshotRef = useRef<DiagramSnapshot | null>(activeSnapshot);
  snapshotRef.current = activeSnapshot;

  const setActive = useCallback((tabId: WorkspaceFileId) => {
    activeTabIdRef.current = tabId;
    setActiveTabId(tabId);
  }, []);

  const getCurrentSnapshot = useCallback(() => {
    const currentTabId = activeTabIdRef.current;
    return documentRecordByTabIdRef.current.get(currentTabId)?.snapshot ?? null;
  }, []);

  const setTabSaveState = useCallback((tabId: WorkspaceFileId, saveState: WorkspaceSaveState) => {
    setTabs((currentTabs) => {
      let didChange = false;
      const nextTabs = currentTabs.map((tab) => {
        if (tab.id !== tabId || tab.saveState === 'saving' || tab.saveState === saveState) return tab;

        didChange = true;
        return {
          ...tab,
          saveState,
        };
      });

      return didChange ? nextTabs : currentTabs;
    });
  }, []);

  const handleSnapshotChange = useCallback((snapshot: DiagramSnapshot) => {
    const tabId = activeTabIdRef.current;
    const currentRecord = documentRecordByTabIdRef.current.get(tabId) ?? createDocumentRecord(null);
    const nextRecord = {
      ...currentRecord,
      snapshot,
    };

    documentRecordByTabIdRef.current.set(tabId, nextRecord);
    snapshotRef.current = snapshot;
    setTabSaveState(tabId, resolveSnapshotSaveState(snapshot, nextRecord.savedFingerprint));

    if (tabId === UNTITLED_DOCUMENT_ID) {
      window.clearTimeout(persistTimerRef.current);
      persistTimerRef.current = window.setTimeout(() => appStorage.saveScene(snapshot), UNTITLED_AUTOSAVE_DELAY_MS);
    }
  }, [setTabSaveState]);

  const openEntryAsTab = useCallback(async (entry: WorkspaceEntry) => {
    if (entry.kind === 'directory') return;

    if (tabsRef.current.some((tab) => tab.id === entry.id)) {
      setActive(entry.id);
      return;
    }

    setTabs((currentTabs) => [...currentTabs, createLoadingTab(entry)]);
    setActive(entry.id);

    try {
      const provider = workspaceProviderFactory.getProvider(entry.providerKind);
      const document = await provider.readDocument(entry);
      documentRecordByTabIdRef.current.set(entry.id, createDocumentRecord(document.snapshot));
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

    documentRecordByTabIdRef.current.delete(tabId);
    setTabs((currentTabs) => {
      const nextTabs = currentTabs.filter((candidate) => candidate.id !== tabId);

      if (activeTabIdRef.current === tabId) {
        const closedTabIndex = currentTabs.findIndex((candidate) => candidate.id === tabId);
        const nextActiveTab = nextTabs[Math.max(0, closedTabIndex - 1)] ?? nextTabs[0];
        const nextActiveTabId = nextActiveTab?.id ?? UNTITLED_DOCUMENT_ID;
        activeTabIdRef.current = nextActiveTabId;
        setActiveTabId(nextActiveTabId);
      }

      if (nextTabs.length > 0) return nextTabs;

      const untitledSnapshot = appStorage.loadScene();
      documentRecordByTabIdRef.current.set(UNTITLED_DOCUMENT_ID, createDocumentRecord(untitledSnapshot));
      activeTabIdRef.current = UNTITLED_DOCUMENT_ID;
      setActiveTabId(UNTITLED_DOCUMENT_ID);
      return [createUntitledTab()];
    });
  }, [tabs]);

  const saveActiveTab = useCallback(async () => {
    const tabId = activeTabIdRef.current;
    const tab = tabs.find((candidate) => candidate.id === tabId);
    const snapshot = documentRecordByTabIdRef.current.get(tabId)?.snapshot;
    if (!tab || !snapshot || !tab.isSupported) return;

    setTabs((currentTabs) =>
      currentTabs.map((candidate) =>
        candidate.id === tabId ? { ...candidate, saveState: 'saving', error: null } : candidate,
      ),
    );

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

      const savedFingerprint = createSnapshotFingerprint(snapshot);
      const currentRecord = documentRecordByTabIdRef.current.get(tabId) ?? createDocumentRecord(null);
      documentRecordByTabIdRef.current.set(tabId, {
        ...currentRecord,
        savedFingerprint,
      });

      setTabs((currentTabs) =>
        currentTabs.map((candidate) => {
          if (candidate.id !== tabId) return candidate;

          const currentSnapshot = documentRecordByTabIdRef.current.get(tabId)?.snapshot ?? null;
          return {
            ...candidate,
            saveState: resolveSnapshotSaveState(currentSnapshot, savedFingerprint),
            error: null,
          };
        }),
      );
    } catch (error) {
      setTabs((currentTabs) =>
        currentTabs.map((candidate) =>
          candidate.id === tabId ? { ...candidate, saveState: 'error', error: toErrorMessage(error) } : candidate,
        ),
      );
    }
  }, [tabs]);

  const value = useMemo<WorkspaceTabManagerContextValue>(() => ({
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
  }), [
    tabs,
    activeTab,
    activeTabId,
    activeSnapshot,
    getCurrentSnapshot,
    handleSnapshotChange,
    openEntryAsTab,
    openUntitledTab,
    switchTab,
    closeTab,
    saveActiveTab,
  ]);

  return (
    <WorkspaceTabManagerContext.Provider value={value}>
      {children}
    </WorkspaceTabManagerContext.Provider>
  );
}

export function useWorkspaceTabManager() {
  const value = useContext(WorkspaceTabManagerContext);
  if (!value) throw new Error('useWorkspaceTabManager must be used within WorkspaceTabManagerProvider');
  return value;
}
