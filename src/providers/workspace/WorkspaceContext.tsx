import { createContext, useContext, type RefObject } from 'react';
import type {
  WorkspaceEntry,
  WorkspaceFileId,
  WorkspaceRoot,
  WorkspaceTab,
} from '../../lib/workspace/types';
import type { AppSettings, DiagramSnapshot, ExcalidrawApi } from '../../types';

export type WorkspaceContextValue = {
  settings: AppSettings;
  root: WorkspaceRoot | null;
  entriesByParentId: Record<string, WorkspaceEntry[]>;
  expandedEntryIds: Set<WorkspaceFileId>;
  selectedEntryId: WorkspaceFileId | null;
  isOpeningRoot: boolean;
  treeError: string | null;
  tabs: WorkspaceTab[];
  activeTab: WorkspaceTab | null;
  activeTabId: WorkspaceFileId | null;
  activeSnapshot: DiagramSnapshot | null;
  initialSnapshot: DiagramSnapshot | null;
  snapshotRef: RefObject<DiagramSnapshot | null>;
  setDiagramApi: (api: ExcalidrawApi) => void;
  getCurrentSnapshot: () => DiagramSnapshot | null;
  handleSnapshotChange: (snapshot: DiagramSnapshot) => void;
  handleSettingsChange: (settings: AppSettings) => void;
  openWorkspaceRoot: () => Promise<void>;
  refreshWorkspaceRoot: () => Promise<void>;
  toggleDirectory: (entry: WorkspaceEntry) => Promise<void>;
  selectEntry: (entry: WorkspaceEntry) => Promise<void>;
  openUntitledTab: () => void;
  switchTab: (tabId: WorkspaceFileId) => void;
  closeTab: (tabId: WorkspaceFileId) => void;
  saveActiveTab: () => Promise<void>;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return value;
}
