import { useMemo } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { DiagramSnapshot } from '../../types';

type DiagramCanvasProps = {
  initialSnapshot: DiagramSnapshot | null;
  theme: 'light' | 'dark';
  onSnapshotChange: (snapshot: DiagramSnapshot) => void;
  onApiReady: (api: ExcalidrawImperativeAPI) => void;
};

function persistenceAppState(appState: AppState): Partial<AppState> {
  return {
    viewBackgroundColor: appState.viewBackgroundColor,
    currentItemStrokeColor: appState.currentItemStrokeColor,
    currentItemBackgroundColor: appState.currentItemBackgroundColor,
    currentItemFillStyle: appState.currentItemFillStyle,
    currentItemStrokeWidth: appState.currentItemStrokeWidth,
    currentItemStrokeStyle: appState.currentItemStrokeStyle,
    currentItemRoughness: appState.currentItemRoughness,
    currentItemOpacity: appState.currentItemOpacity,
    gridSize: appState.gridSize,
    theme: appState.theme,
  };
}

export function DiagramCanvas({ initialSnapshot, theme, onSnapshotChange, onApiReady }: DiagramCanvasProps) {
  const initialData = useMemo(
    () =>
      initialSnapshot
        ? {
            elements: initialSnapshot.elements,
            appState: { ...initialSnapshot.appState, theme },
            files: initialSnapshot.files,
          }
        : { appState: { theme } },
    [initialSnapshot, theme],
  );

  return (
    <div className="diagram-canvas">
      <Excalidraw
        excalidrawAPI={onApiReady}
        initialData={initialData}
        theme={theme}
        onChange={(elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles) => {
          onSnapshotChange({
            elements,
            appState: persistenceAppState(appState),
            files,
            updatedAt: Date.now(),
          });
        }}
      />
    </div>
  );
}
