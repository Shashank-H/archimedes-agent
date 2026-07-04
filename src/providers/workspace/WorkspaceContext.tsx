import { createContext, useContext } from 'react';
import type {
  WorkspaceEntry,
  WorkspaceFileId,
  WorkspaceRoot,
} from '../../lib/workspace/types';
import type { AppSettings, ExcalidrawApi } from '../../types';

export type WorkspaceContextValue = {
  settings: AppSettings;
  root: WorkspaceRoot | null;
  entriesByParentId: Record<string, WorkspaceEntry[]>;
  expandedEntryIds: Set<WorkspaceFileId>;
  selectedEntryId: WorkspaceFileId | null;
  isOpeningRoot: boolean;
  treeError: string | null;
  setDiagramApi: (api: ExcalidrawApi) => void;
  handleSettingsChange: (settings: AppSettings) => void;
  openWorkspaceRoot: () => Promise<void>;
  refreshWorkspaceRoot: () => Promise<void>;
  toggleDirectory: (entry: WorkspaceEntry) => Promise<void>;
  selectEntry: (entry: WorkspaceEntry) => Promise<void>;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return value;
}
