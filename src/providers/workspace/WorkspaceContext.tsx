import { createContext, useContext, type RefObject } from 'react';
import type { AppSettings, DiagramSnapshot, ExcalidrawApi } from '../../types';

export type WorkspaceContextValue = {
  initialSnapshot: DiagramSnapshot | null;
  settings: AppSettings;
  setDiagramApi: (api: ExcalidrawApi) => void;
  getCurrentSnapshot: () => DiagramSnapshot | null;
  snapshotRef: RefObject<DiagramSnapshot | null>;
  handleSnapshotChange: (snapshot: DiagramSnapshot) => void;
  handleSettingsChange: (settings: AppSettings) => void;
};

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return value;
}
