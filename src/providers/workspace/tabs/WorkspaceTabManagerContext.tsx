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
import { useAppDialogs } from '../../../components/ui/useAppDialogs';
import type {
  WorkspaceEntry,
  WorkspaceFileId,
  WorkspaceRoot,
  WorkspaceSaveState,
  WorkspaceTab,
} from '../../../lib/workspace/types';
import { createLocalDraftRecord } from '../../../lib/workspace/untitled';
import type { DiagramSnapshot } from '../../../types';
import { WORKSPACE_TAB_DIALOG_COPY } from './workspaceTabDialog.constants';

type WorkspaceDocumentRecord = {
  snapshot: DiagramSnapshot | null;
  savedFingerprint: string | null;
  renderVersion: number;
  hasReceivedCanvasChange: boolean;
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
  activeDocumentKey: string | null;
  snapshotRef: RefObject<DiagramSnapshot | null>;
  getCurrentSnapshot: () => DiagramSnapshot | null;
  handleSnapshotChange: (tabId: WorkspaceFileId, snapshot: DiagramSnapshot) => boolean;
  openEntryAsTab: (entry: WorkspaceEntry) => Promise<void>;
  openUntitledTab: () => void;
  openAppSettingsTab: () => void;
  switchTab: (tabId: WorkspaceFileId) => void;
  closeTab: (tabId: WorkspaceFileId) => Promise<void>;
  closeActiveTab: () => Promise<void>;
  closeSavedTabs: () => void;
  closeAllTabs: () => Promise<void>;
  clearActiveCanvasContents: () => Promise<void>;
  saveTab: (tabId: WorkspaceFileId) => Promise<void>;
  saveActiveTab: () => Promise<void>;
  setWorkspaceSaveTarget: (target: WorkspaceSaveTarget) => void;
};

export const APP_SETTINGS_TAB_ID = 'app://settings' as WorkspaceFileId;

const UNTITLED_ROOT_ID = 'untitled://local/root';

function createAppSettingsTab(): WorkspaceTab {
  return {
    id: APP_SETTINGS_TAB_ID,
    title: 'App Settings',
    path: 'Archimedes / App Settings',
    providerKind: 'app',
    rootId: null,
    isUntitled: false,
    isSupported: false,
    loadState: 'loaded',
    saveState: 'idle',
    error: null,
    appPage: 'settings',
  };
}

export function isAppSettingsTab(tab: WorkspaceTab | null | undefined) {
  return tab?.appPage === 'settings';
}

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

function createDefaultUntitledFileName(title: string) {
  const titleNumber = title.match(/^Untitled\s+(\d+)$/i)?.[1];
  return titleNumber ? `untitled-${titleNumber}.excalidraw` : 'untitled.excalidraw';
}

function createSnapshotFingerprint(snapshot: DiagramSnapshot | null) {
  return snapshot ? serializeExcalidrawFile(snapshot) : null;
}

function validateWorkspaceFileName(fileName: string) {
  const copy = WORKSPACE_TAB_DIALOG_COPY.saveUntitledFile;
  const trimmedFileName = fileName.trim();
  if (trimmedFileName.length === 0) return copy.emptyError;
  if (/[\\/]/.test(trimmedFileName)) return copy.separatorError;
  return null;
}

function createDocumentRecord(snapshot: DiagramSnapshot | null): WorkspaceDocumentRecord {
  return {
    snapshot,
    savedFingerprint: createSnapshotFingerprint(snapshot),
    renderVersion: 0,
    hasReceivedCanvasChange: false,
  };
}

const EMPTY_DIAGRAM_SAVE_MESSAGE = 'You cannot save an empty diagram.';

export function canSaveWorkspaceTab(tab: WorkspaceTab | null | undefined) {
  return Boolean(
    tab?.isSupported
      && tab.loadState === 'loaded'
      && (tab.saveState === 'dirty' || (tab.saveState === 'error' && tab.error !== EMPTY_DIAGRAM_SAVE_MESSAGE)),
  );
}

function hasUnsavedWorkspaceTabChanges(tab: WorkspaceTab | null | undefined) {
  return tab?.saveState === 'dirty' || tab?.saveState === 'error';
}

function createClearedSnapshot(snapshot: DiagramSnapshot | null): DiagramSnapshot {
  return {
    elements: [],
    appState: snapshot?.appState ?? {},
    files: {},
    updatedAt: Date.now(),
  };
}

function resolveSnapshotSaveState(snapshot: DiagramSnapshot | null, savedFingerprint: string | null): WorkspaceSaveState {
  return createSnapshotFingerprint(snapshot) === savedFingerprint ? 'saved' : 'dirty';
}

function isEmptyDiagramSnapshot(snapshot: DiagramSnapshot | null | undefined) {
  if (!snapshot) return true;

  const visibleElements = snapshot.elements.filter((element) => !('isDeleted' in element) || !element.isDeleted);
  return visibleElements.length === 0 && Object.keys(snapshot.files ?? {}).length === 0;
}

function getEmptyUntitledSaveMessage() {
  return EMPTY_DIAGRAM_SAVE_MESSAGE;
}

const WorkspaceTabManagerContext = createContext<WorkspaceTabManagerContextValue | null>(null);

export function WorkspaceTabManagerProvider({ children }: { children: ReactNode }) {
  const { confirm, prompt, dialogs } = useAppDialogs();
  const initialLocalDrafts = useMemo(() => appStorage.loadLocalDrafts(), []);
  const initialLocalDraftTabs = useMemo(() => initialLocalDrafts.map((draft) => createUntitledTab(draft)), [initialLocalDrafts]);
  const documentRecordByTabIdRef = useRef(new Map<WorkspaceFileId, WorkspaceDocumentRecord>(
    initialLocalDrafts.map((draft) => [draft.id as WorkspaceFileId, createDocumentRecord(draft.snapshot)]),
  ));
  const [tabs, setTabs] = useState<WorkspaceTab[]>(initialLocalDraftTabs);
  const [, setDocumentVersionBump] = useState(0);
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
  const activeRecord = activeTab ? documentRecordByTabIdRef.current.get(activeTab.id) ?? null : null;
  const activeSnapshot = activeRecord?.snapshot ?? null;
  const activeDocumentKey = activeTab ? `${activeTab.id}:${activeRecord?.renderVersion ?? 0}` : null;
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
          error: saveState === 'error' ? tab.error : null,
        };
      });

      return didChange ? nextTabs : currentTabs;
    });
  }, []);

  const setTabSaveError = useCallback((tabId: WorkspaceFileId, message: string) => {
    setTabs((currentTabs) =>
      currentTabs.map((tab) =>
        tab.id === tabId
          ? { ...tab, saveState: 'error', error: message }
          : tab,
      ),
    );
  }, []);

  const handleSnapshotChange = useCallback((tabId: WorkspaceFileId, snapshot: DiagramSnapshot) => {
    const currentRecord = documentRecordByTabIdRef.current.get(tabId);
    const currentTab = tabsRef.current.find((tab) => tab.id === tabId);
    if (!currentRecord || !currentTab) return false;

    const currentFingerprint = createSnapshotFingerprint(currentRecord.snapshot);
    const nextFingerprint = createSnapshotFingerprint(snapshot);

    if (!currentRecord.hasReceivedCanvasChange && currentTab.saveState === 'saved') {
      const nextRecord = {
        ...currentRecord,
        snapshot,
        savedFingerprint: nextFingerprint,
        hasReceivedCanvasChange: true,
      };

      documentRecordByTabIdRef.current.set(tabId, nextRecord);
      if (activeTabIdRef.current === tabId) {
        snapshotRef.current = snapshot;
      }
      return false;
    }

    if (currentFingerprint === nextFingerprint) {
      if (!currentRecord.hasReceivedCanvasChange) {
        documentRecordByTabIdRef.current.set(tabId, {
          ...currentRecord,
          hasReceivedCanvasChange: true,
        });
      }
      return false;
    }

    const nextRecord = {
      ...currentRecord,
      snapshot,
      hasReceivedCanvasChange: true,
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

  const openAppSettingsTab = useCallback(() => {
    const existingTab = tabsRef.current.find(isAppSettingsTab);
    if (existingTab) {
      setActive(existingTab.id);
      return;
    }

    const tab = createAppSettingsTab();
    setTabs((currentTabs) => (currentTabs.some(isAppSettingsTab) ? currentTabs : [...currentTabs, tab]));
    setActive(tab.id);
  }, [setActive]);

  const switchTab = useCallback((tabId: WorkspaceFileId) => setActive(tabId), [setActive]);

  const closeTabs = useCallback((tabIds: Set<WorkspaceFileId>) => {
    if (tabIds.size === 0) return;

    const currentTabs = tabsRef.current;
    const nextTabs = currentTabs.filter((candidate) => !tabIds.has(candidate.id));
    const activeTabWasClosed = activeTabIdRef.current ? tabIds.has(activeTabIdRef.current) : false;
    const firstClosedIndex = currentTabs.findIndex((candidate) => tabIds.has(candidate.id));
    const nextActiveTab = activeTabWasClosed
      ? nextTabs[Math.max(0, firstClosedIndex - 1)] ?? nextTabs[0] ?? null
      : nextTabs.find((candidate) => candidate.id === activeTabIdRef.current) ?? nextTabs[0] ?? null;
    const nextActiveTabId = nextActiveTab?.id ?? null;

    currentTabs.forEach((tab) => {
      if (!tabIds.has(tab.id)) return;
      if (!tab.appPage) documentRecordByTabIdRef.current.delete(tab.id);
      if (tab.isUntitled) appStorage.deleteLocalDraft(tab.id);
    });

    activeTabIdRef.current = nextActiveTabId;
    setActiveTabId(nextActiveTabId);
    setTabs(nextTabs);
  }, []);

  const closeTab = useCallback(async (tabId: WorkspaceFileId) => {
    const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
    if (!tab) return;
    if (hasUnsavedWorkspaceTabChanges(tab)) {
      const shouldClose = await confirm({
        ...WORKSPACE_TAB_DIALOG_COPY.closeDirtyTab(tab),
        variant: 'danger',
      });
      if (!shouldClose) return;
    }
    closeTabs(new Set([tabId]));
  }, [closeTabs, confirm]);

  const closeActiveTab = useCallback(async () => {
    const activeTabId = activeTabIdRef.current;
    if (activeTabId) await closeTab(activeTabId);
  }, [closeTab]);

  const closeSavedTabs = useCallback(() => {
    const savedTabIds = tabsRef.current
      .filter((tab) => tab.saveState === 'saved')
      .map((tab) => tab.id);
    closeTabs(new Set(savedTabIds));
  }, [closeTabs]);

  const closeAllTabs = useCallback(async () => {
    const currentTabs = tabsRef.current;
    if (currentTabs.length === 0) return;

    const unsavedTabs = currentTabs.filter(hasUnsavedWorkspaceTabChanges);
    if (unsavedTabs.length > 0) {
      const shouldClose = await confirm({
        ...WORKSPACE_TAB_DIALOG_COPY.closeAllTabs(currentTabs.length, unsavedTabs.length, unsavedTabs[0]),
        variant: 'danger',
      });
      if (!shouldClose) return;
    }

    closeTabs(new Set(currentTabs.map((tab) => tab.id)));
  }, [closeTabs, confirm]);

  const clearActiveCanvasContents = useCallback(async () => {
    const activeTabId = activeTabIdRef.current;
    const activeTab = tabsRef.current.find((candidate) => candidate.id === activeTabId);
    if (!activeTab || activeTab.loadState !== 'loaded' || !activeTab.isSupported) return;
    const shouldClear = await confirm({
      ...WORKSPACE_TAB_DIALOG_COPY.clearCanvas(activeTab),
      variant: 'danger',
    });
    if (!shouldClear) return;

    const currentRecord = documentRecordByTabIdRef.current.get(activeTab.id) ?? createDocumentRecord(null);
    const nextSnapshot = createClearedSnapshot(currentRecord.snapshot);
    const nextRecord = {
      ...currentRecord,
      snapshot: nextSnapshot,
      renderVersion: currentRecord.renderVersion + 1,
      hasReceivedCanvasChange: false,
    };

    documentRecordByTabIdRef.current.set(activeTab.id, nextRecord);
    snapshotRef.current = nextSnapshot;
    setDocumentVersionBump((current) => current + 1);
    setTabSaveState(activeTab.id, resolveSnapshotSaveState(nextSnapshot, nextRecord.savedFingerprint));
  }, [confirm, setTabSaveState]);

  const saveTab = useCallback(async (tabId: WorkspaceFileId) => {
    const tab = tabsRef.current.find((candidate) => candidate.id === tabId);
    const snapshot = documentRecordByTabIdRef.current.get(tabId)?.snapshot;
    if (!tab) return;

    if (tab.isUntitled && isEmptyDiagramSnapshot(snapshot)) {
      setTabSaveError(tab.id, getEmptyUntitledSaveMessage());
      return;
    }

    if (!canSaveWorkspaceTab(tab) || !snapshot) return;

    setTabs((currentTabs) =>
      currentTabs.map((candidate) =>
        candidate.id === tabId ? { ...candidate, saveState: 'saving', error: null } : candidate,
      ),
    );

    try {
      const workspaceSaveTarget = workspaceSaveTargetRef.current;
      const savedFingerprint = createSnapshotFingerprint(snapshot);

      if (tab.isUntitled) {
        const { document, entry } = await (async () => {
          const workspaceRoot = workspaceSaveTarget.root;
          if (!workspaceRoot) {
            const provider = workspaceProviderFactory.getDefaultProvider();
            if (!provider.createFileDocument) throw new Error('This environment cannot save files.');
            return provider.createFileDocument(tab.title, snapshot);
          }

          const provider = workspaceProviderFactory.getProvider(workspaceRoot.providerKind);
          if (!provider.createDocument) throw new Error('This environment cannot save files.');

          const fileName = await prompt({
            ...WORKSPACE_TAB_DIALOG_COPY.saveUntitledFile,
            defaultValue: createDefaultUntitledFileName(tab.title),
            validate: validateWorkspaceFileName,
          });
          if (!fileName) throw createAbortError();
          return provider.createDocument(workspaceRoot, fileName, snapshot);
        })();

        const currentRecord = documentRecordByTabIdRef.current.get(tabId) ?? createDocumentRecord(null);
        documentRecordByTabIdRef.current.delete(tabId);
        documentRecordByTabIdRef.current.set(document.id, {
          ...currentRecord,
          snapshot,
          savedFingerprint,
          renderVersion: currentRecord.renderVersion + 1,
          hasReceivedCanvasChange: false,
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
        if (entry.rootId) {
          await workspaceSaveTarget.onWorkspaceFileCreated(entry);
        }
        return;
      }

      if (tab.providerKind === 'app') return;

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
  }, [prompt, setTabSaveError]);

  const saveActiveTab = useCallback(async () => {
    const activeTabId = activeTabIdRef.current;
    if (activeTabId) await saveTab(activeTabId);
  }, [saveTab]);

  const value = useMemo<WorkspaceTabManagerContextValue>(() => ({
    tabs,
    activeTab,
    activeTabId,
    activeSnapshot,
    activeDocumentKey,
    snapshotRef,
    getCurrentSnapshot,
    handleSnapshotChange,
    openEntryAsTab,
    openUntitledTab,
    openAppSettingsTab,
    switchTab,
    closeTab,
    closeActiveTab,
    closeSavedTabs,
    closeAllTabs,
    clearActiveCanvasContents,
    saveTab,
    saveActiveTab,
    setWorkspaceSaveTarget,
  }), [
    tabs,
    activeTab,
    activeTabId,
    activeSnapshot,
    activeDocumentKey,
    getCurrentSnapshot,
    handleSnapshotChange,
    openEntryAsTab,
    openUntitledTab,
    openAppSettingsTab,
    switchTab,
    closeTab,
    closeActiveTab,
    closeSavedTabs,
    closeAllTabs,
    clearActiveCanvasContents,
    saveTab,
    saveActiveTab,
    setWorkspaceSaveTarget,
  ]);

  return (
    <WorkspaceTabManagerContext.Provider value={value}>
      {children}
      {dialogs}
    </WorkspaceTabManagerContext.Provider>
  );
}

export function useWorkspaceTabManager() {
  const value = useContext(WorkspaceTabManagerContext);
  if (!value) throw new Error('useWorkspaceTabManager must be used within WorkspaceTabManagerProvider');
  return value;
}
