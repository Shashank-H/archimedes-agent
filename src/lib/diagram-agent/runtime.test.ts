import { describe, expect, it, vi } from 'vitest';

vi.mock('@excalidraw/excalidraw', () => ({
  convertToExcalidrawElements: (elements: unknown[]) => elements,
}));
import type { DiagramSnapshot } from '../../types';
import { DiagramToolRuntime } from './runtime';
import type { DiagramPlan } from './types';

const emptySnapshot = (): DiagramSnapshot => ({ elements: [], appState: {}, files: {}, updatedAt: 1 });

describe('DiagramToolRuntime', () => {
  it('validates the complete plan before mutating the snapshot', () => {
    const plan = {
      target: { type: 'current' },
      summary: 'unsafe plan',
      operations: [
        { type: 'create', elements: [{ type: 'rectangle', x: 0, y: 0, width: 100, height: 100 }] },
        { type: 'update', elementId: 'missing', patch: { isDeleted: true } },
      ],
    } as unknown as DiagramPlan;

    expect(() => new DiagramToolRuntime().applyPlan(emptySnapshot(), plan)).toThrow(/unsupported properties/i);
  });

  it('rejects non-finite geometry and invalid app-state values', () => {
    const geometry = { target: { type: 'current' }, summary: 'bad geometry', operations: [{ type: 'create', elements: [{ type: 'rectangle', width: -1, height: 20 }] }] } as unknown as DiagramPlan;
    const appState = { target: { type: 'current' }, summary: 'bad theme', operations: [{ type: 'appState', patch: { theme: 'neon' } }] } as unknown as DiagramPlan;

    expect(() => new DiagramToolRuntime().applyPlan(emptySnapshot(), geometry)).toThrow(/width/i);
    expect(() => new DiagramToolRuntime().applyPlan(emptySnapshot(), appState)).toThrow(/theme/i);
  });
});
