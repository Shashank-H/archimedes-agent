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
import { getWorkspaceResourceKey } from '../../../lib/workspace/types';
import type {
  WorkspaceEntry,
  WorkspaceFileId,
  WorkspaceRoot,
  WorkspaceSaveState,
  WorkspaceTab,
} from '../../../lib/workspace/types';
import { createLocalDraftRecord } from '../../../lib/workspace/untitled';
import type { DiagramSnapshot } from '../../../types';

type WorkspaceDocumentRecord = {
  snapshot: DiagramSnapshot | null;
  savedFingerprint: string | null;
};

type WorkspaceSaveTarget = {
  root: WorkspaceRoot | null;
  onWorkspaceFileCreated: (entry: WorkspaceEntry) => Promise<void> | void;
};

type WorkspaceTabManagerContextValue = {
  tabs: WorkspaceTab[];
  activeTab: WorkspaceTab | null;
  activeTabId: WorkspaceFileId | null;
  activeSnapshot: DiagramSnapshot | null;
  snapshotRef: RefObject<DiagramSnapshot | null>;
  getCurrentSnapshot: () => DiagramSnapshot | null;
  handleSnapshotChange: (tabId: WorkspaceFileId, snapshot: DiagramSnapshot) => boolean;
  openEntryAsTab: (entry: WorkspaceEntry) => Promise<void>;
  openUntitledTab: () => void;
  switchTab: (tabId: WorkspaceFileId) => void;
  closeTab: (tabId: WorkspaceFileId) => void;
  saveTab: (tabId: WorkspaceFileId) => Promise<void>;
  saveActiveTab: () => Promise<void>;
  setWorkspaceSaveTarget: (target: WorkspaceSaveTarget) => void;
};

const UNTITLED_ROOT_ID = 'untitled://local/root';

function createUntitledTab(draft: ReturnType<typeof createLocalDraftRecord>): WorkspaceTab {
  return {
    id: draft.id as WorkspaceFileId,
    title: draft.title,
    path: draft.path,
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

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

function createAbortError() {
  return new DOMException('Save cancelled.', 'AbortError');
}

function promptForWorkspaceFileName(suggestedName: string) {
  const fileName = window.prompt('Save this untitled diagram inside the opened workspace folder as:', suggestedName);
  if (!fileName) throw createAbortError();
  return fileName;
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
  const initialLocalDrafts = useMemo(() => appStorage.loadLocalDrafts(), []);
  const initialLocalDraftTabs = useMemo(() => initialLocalDrafts.map((draft) => createUntitledTab(draft)), [initialLocalDrafts]);
  const documentRecordByTabIdRef = useRef(new Map<WorkspaceFileId, WorkspaceDocumentRecord>(
    initialLocalDrafts.map((draft) => [draft.id as WorkspaceFileId, createDocumentRecord(draft.snapshot)]),
  ));
  const [tabs, setTabs] = useState<WorkspaceTab[]>(initialLocalDraftTabs);
  const tabsRef = useRef<WorkspaceTab[]>(tabs);
  tabsRef.current = tabs;
  const initialActiveTabId = initialLocalDraftTabs[0]?.id ?? null;
  const [activeTabId, setActiveTabId] = useState<WorkspaceFileId | null>(initialActiveTabId);
  const activeTabIdRef = useRef<WorkspaceFileId | null>(initialActiveTabId);
  const pendingOpenResourceKeysRef = useRef(new Set<string>());
  const workspaceSaveTargetRef = useRef<WorkspaceSaveTarget>({
    root: null,
    onWorkspaceFileCreated: () => undefined,
  });

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0] ?? null;
  const activeSnapshot = activeTab ? documentRecordByTabIdRef.current.get(activeTab.id)?.snapshot ?? null : null;
  const snapshotRef = useRef<DiagramSnapshot | null>(activeSnapshot);
  snapshotRef.current = activeSnapshot;

  const setActive = useCallback((tabId: WorkspaceFileId | null) => {
    activeTabIdRef.current = tabId;
    setActiveTabId(tabId);
  }, []);

  const getCurrentSnapshot = useCallback(() => {
    const currentTabId = activeTabIdRef.current;
    return currentTabId ? documentRecordByTabIdRef.current.get(currentTabId)?.snapshot ?? null : null;
  }, []);

  const setWorkspaceSaveTarget = useCallback((target: WorkspaceSaveTarget) => {
    workspaceSaveTargetRef.current = target;
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

  const handleSnapshotChange = useCallback((tabId: WorkspaceFileId, snapshot: DiagramSnapshot) => {
    const currentRecord = documentRecordByTabIdRef.current.get(tabId);
    if (!currentRecord || !tabsRef.current.some((tab) => tab.id === tabId)) return false;

    const currentFingerprint = createSnapshotFingerprint(currentRecord.snapshot);
    const nextFingerprint = createSnapshotFingerprint(snapshot);

    if (currentFingerprint === nextFingerprint) return false;

    const nextRecord = {
      ...currentRecord,
      snapshot,
    };

    documentRecordByTabIdRef.current.set(tabId, nextRecord);
    if (activeTabIdRef.current === tabId) {
      snapshotRef.current = snapshot;
    }
    setTabSaveState(tabId, resolveSnapshotSaveState(snapshot, nextRecord.savedFingerprint));

    return activeTabIdRef.current === tabId;
  }, [setTabSaveState]);

  const openEntryAsTab = useCallback(async (entry: WorkspaceEntry) => {
    if (entry.kind === 'directory') return;

    const entryResourceKey = getWorkspaceResourceKey(entry);
    const existingTab = tabsRef.current.find((tab) => getWorkspaceResourceKey(tab) === entryResourceKey);
    if (existingTab) {
      setActive(existingTab.id);
      return;
    }

    if (pendingOpenResourceKeysRef.current.has(entryResourceKey)) {
      setActive(entry.id);
      return;
    }

    pendingOpenResourceKeysRef.current.add(entryResourceKey);
    setTabs((currentTabs) => (
      currentTabs.some((tab) => getWorkspaceResourceKey(tab) === entryResourceKey)
        ? currentTabs
        : [...currentTabs, createLoadingTab(entry)]
    ));
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
    } finally {
      pendingOpenResourceKeysRef.current.delete(entryResourceKey);
    }
  }, [setActive]);

  const openUntitledTab = useCallback(() => {
    const draft = createLocalDraftRecord(null);
    appStorage.saveLocalDraft(draft);
    const tab = createUntitledTab(draft);
    documentRecordByTabIdRef.current.set(tab.id, createDocumentRecord(draft.snapshot));
    setTabs((currentTabs) => [tab, ...currentTabs]);
    setActive(tab.id);
  }, [setActive]);

  const switchTab = useCallback((tabId: WorkspaceFileId) => setActive(tabId), [setActive]);

  const closeTab = useCallback((tabId: WorkspaceFileId) => {
    const currentTabs = tabsRef.current;
    const tab = currentTabs.find((candidate) => candidate.id === tabId);
    if (tab?.saveState === 'dirty' && !window.confirm(`Close ${tab.title} without saving?`)) return;

    const closedTabIndex = currentTabs.findIndex((candidate) => candidate.id === tabId);
    const nextTabs = currentTabs.filter((candidate) => candidate.id !== tabId);
    const nextActiveTab = activeTabIdRef.current === tabId
      ? nextTabs[Math.max(0, closedTabIndex - 1)] ?? nextTabs[0] ?? null
      : nextTabs.find((candidate) => candidate.id === activeTabIdRef.current) ?? nextTabs[0] ?? null;
    const nextActiveTabId = nextActiveTab?.id ?? null;

    documentRecordByTabIdRef.current.delete(tabId);
    if (tab?.isUntitled) appStorage.deleteLocalDraft(tabId);
    activeTabIdRef.current = nextActiveTabId;
    setActiveTabId(nextActiveTabId);
    setTabs(nextTabs);
  }, []);

  const saveTab = useCallback(async (tabId: WorkspaceFileId) => {
    const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
    const snapshot = documentRecordByTabIdRef.current.get(tabId)?.snapshot;
    if (!tab || !snapshot || !tab.isSupported || tab.loadState !== 'loaded' || tab.saveState === 'saving') return;

    setTabs((currentTabs) =>
      currentTabs.map((candidate) =>
        candidate.id === tabId ? { ...candidate, saveState: 'saving', error: null } : candidate,
      ),
    );

    try {
      const workspaceSaveTarget = workspaceSaveTargetRef.current;
      const savedFingerprint = createSnapshotFingerprint(snapshot);

      if (tab.isUntitled && workspaceSaveTarget.root) {
        const provider = workspaceProviderFactory.getProvider(workspaceSaveTarget.root.providerKind);
        if (!provider.createDocument) throw new Error('This workspace cannot create files.');

        const fileName = promptForWorkspaceFileName(tab.title);
        const { document, entry } = await provider.createDocument(workspaceSaveTarget.root, fileName, snapshot);
        const currentRecord = documentRecordByTabIdRef.current.get(tabId) ?? createDocumentRecord(null);
        documentRecordByTabIdRef.current.delete(tabId);
        documentRecordByTabIdRef.current.set(document.id, {
          ...currentRecord,
          savedFingerprint,
        });
        appStorage.deleteLocalDraft(tabId);
        activeTabIdRef.current = document.id;
        setActiveTabId(document.id);
        setTabs((currentTabs) =>
          currentTabs.map((candidate) =>
            candidate.id === tabId
              ? {
                  ...candidate,
                  id: document.id,
                  title: document.title,
                  path: document.path,
                  providerKind: document.providerKind,
                  rootId: document.rootId,
                  isUntitled: false,
                  saveState: 'saved',
                  error: null,
                }
              : candidate,
          ),
        );
        await workspaceSaveTarget.onWorkspaceFileCreated(entry);
        return;
      }

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
      const didCancelSave = isAbortError(error);
      const savedFingerprint = documentRecordByTabIdRef.current.get(tabId)?.savedFingerprint ?? null;

      setTabs((currentTabs) =>
        currentTabs.map((candidate) =>
          candidate.id === tabId
            ? {
                ...candidate,
                saveState: didCancelSave ? resolveSnapshotSaveState(snapshot, savedFingerprint) : 'error',
                error: didCancelSave ? null : toErrorMessage(error),
              }
            : candidate,
        ),
      );
    }
  }, []);

  const saveActiveTab = useCallback(async () => {
    const activeTabId = activeTabIdRef.current;
    if (activeTabId) await saveTab(activeTabId);
  }, [saveTab]);

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
    saveTab,
    saveActiveTab,
    setWorkspaceSaveTarget,
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
    saveTab,
    saveActiveTab,
    setWorkspaceSaveTarget,
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
