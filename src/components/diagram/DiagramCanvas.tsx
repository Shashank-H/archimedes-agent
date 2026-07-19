import { useMemo } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { createPersistentAppState } from '../../lib/excalidrawFile';
import { toEffectiveBaseTheme } from '../../lib/theme';
import type { AppTheme, DiagramSnapshot } from '../../types';

type DiagramCanvasProps = {
  documentKey: string;
  initialSnapshot: DiagramSnapshot | null;
  theme: AppTheme;
  onSnapshotChange: (snapshot: DiagramSnapshot) => void;
  onApiReady: (api: ExcalidrawImperativeAPI) => void;
};

const EXCALIDRAW_UI_OPTIONS = {
  canvasActions: {
    saveToActiveFile: false,
  },
} as const;

export function DiagramCanvas({ documentKey, initialSnapshot, theme, onSnapshotChange, onApiReady }: DiagramCanvasProps) {
  const excalidrawTheme = toEffectiveBaseTheme(theme);
  const initialData = useMemo(
    () =>
      initialSnapshot
        ? {
            elements: initialSnapshot.elements,
            appState: { ...initialSnapshot.appState, theme: excalidrawTheme },
            files: initialSnapshot.files,
          }
        : { appState: { theme: excalidrawTheme } },
    // Excalidraw treats initialData as initialization input. If this depends on
    // the live snapshot, each onChange can feed a new initialData object back
    // into Excalidraw and create an update loop. The component is keyed by
    // documentKey, so switching documents remounts with a fresh snapshot.
    // Theme changes are handled by the dedicated `theme` prop below.
    [documentKey],
  );

  return (
    <div className="diagram-canvas">
      <Excalidraw
        excalidrawAPI={onApiReady}
        initialData={initialData}
        theme={excalidrawTheme}
        UIOptions={EXCALIDRAW_UI_OPTIONS}
        onChange={(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
          onSnapshotChange({
            elements,
            // Persist only document-level app state. View-only changes such as
            // zoom and pan are dropped so they do not mark tabs dirty or
            // trigger proactive reviews.
            appState: createPersistentAppState(appState),
            files,
            updatedAt: Date.now(),
          });
        }}
      />
    </div>
  );
}
