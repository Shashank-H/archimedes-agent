import { useCallback, useEffect, useMemo, useRef } from 'react';
import { appStorage } from '../../../lib/storage';
import type { DiagramSnapshot } from '../../../types';

export function useDiagramSnapshot() {
  const initialSnapshot = useMemo(() => appStorage.loadScene(), []);
  const snapshotRef = useRef<DiagramSnapshot | null>(initialSnapshot);
  const persistTimerRef = useRef<number | undefined>(undefined);

  const getCurrentSnapshot = useCallback(() => snapshotRef.current, []);

  const handleSnapshotChange = useCallback((nextSnapshot: DiagramSnapshot) => {
    // Keep high-frequency canvas changes out of React state. Excalidraw calls
    // onChange often; setting parent state here can cause Excalidraw to
    // re-render/reinitialize in a loop.
    snapshotRef.current = nextSnapshot;

    window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => appStorage.saveScene(nextSnapshot), 600);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(persistTimerRef.current);
  }, []);

  return { initialSnapshot, snapshotRef, getCurrentSnapshot, handleSnapshotChange };
}
