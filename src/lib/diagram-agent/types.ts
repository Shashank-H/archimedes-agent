import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { AppState } from '@excalidraw/excalidraw/types';

export type DiagramTarget =
  | { type: 'current' }
  | { type: 'path'; path: string }
  | { type: 'new'; name?: string }
  | { type: 'tag'; tag: string }
  | { type: 'multiple'; targets: DiagramTarget[] };

export type DiagramStylePatch = Partial<{
  strokeColor: string;
  backgroundColor: string;
  fillStyle: 'hachure' | 'cross-hatch' | 'solid';
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  roughness: number;
  opacity: number;
}>;

export type DiagramElementPatch = DiagramStylePatch & Partial<{
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  text: string;
}>;

export type DiagramOperation =
  | { type: 'create'; elements: ExcalidrawElementSkeleton[] }
  | { type: 'update'; elementId: string; patch: DiagramElementPatch }
  | { type: 'delete'; elementIds: string[] }
  | { type: 'style'; elementIds: string[]; patch: DiagramStylePatch }
  | { type: 'group'; elementIds: string[]; groupId?: string }
  | { type: 'order'; elementIds: string[]; position: 'front' | 'back' }
  | { type: 'align'; elementIds: string[]; axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' }
  | { type: 'appState'; patch: Partial<Pick<AppState, 'viewBackgroundColor' | 'gridSize' | 'theme'>> };

export type DiagramPlan = {
  summary: string;
  target: DiagramTarget;
  operations: DiagramOperation[];
};

export type DiagramPlanProposal = DiagramPlan & {
  id: string;
  requestedAt: number;
};
