import { useCallback, useRef, type ReactNode } from 'react';
import type { ExcalidrawApi } from '../../types';
import { WorkspaceContext } from './WorkspaceContext';
import { useDiagramSnapshot } from './hooks/useDiagramSnapshot';
import { useWorkspaceSettings } from './hooks/useWorkspaceSettings';

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const { settings, handleSettingsChange } = useWorkspaceSettings();
  const { initialSnapshot, snapshotRef, getCurrentSnapshot, handleSnapshotChange } = useDiagramSnapshot();

  const setDiagramApi = useCallback((api: ExcalidrawApi) => {
    apiRef.current = api;
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        initialSnapshot,
        settings,
        setDiagramApi,
        snapshotRef,
        getCurrentSnapshot,
        handleSnapshotChange,
        handleSettingsChange,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}
