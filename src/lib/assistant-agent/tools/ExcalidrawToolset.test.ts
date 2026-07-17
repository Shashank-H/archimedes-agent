import { describe, expect, it, vi } from 'vitest';
import type { DiagramSnapshot } from '../../../types';
import type { DiagramPlanProposal } from '../../diagram-agent/types';
import { ExcalidrawToolset, normalizeDiagramSnapshot } from './ExcalidrawToolset';

function snapshot(label = 'API'): DiagramSnapshot {
  return {
    elements: [{
      id: 'box-1', type: 'rectangle', x: 10, y: 20, width: 120, height: 60,
      angle: 0, isDeleted: false, groupIds: ['group-1'], frameId: null,
      boundElements: [{ id: 'arrow-1', type: 'arrow' }], label: { text: label },
      strokeColor: '#1e1e1e', backgroundColor: '#a5d8ff', fillStyle: 'solid',
      strokeWidth: 2, strokeStyle: 'dashed', roughness: 1, opacity: 80,
      link: 'https://example.com', points: [[0, 0], [120, 60]],
    } as never],
    appState: { viewBackgroundColor: '#ffffff', gridSize: 20, theme: 'light' },
    files: {}, updatedAt: 1,
  };
}

const plan = {
  summary: 'Add a worker.', target: { type: 'current' },
  operations: [{ type: 'create', elements: [{ type: 'rectangle', x: 200, y: 20, width: 120, height: 60, label: { text: 'Worker' } }] }],
};

describe('ExcalidrawToolset', () => {
  it('normalizes relationships, labels, geometry, and persistent app state', () => {
    expect(normalizeDiagramSnapshot(snapshot())).toMatchObject({
      elements: [{
        id: 'box-1', type: 'rectangle', x: 10, y: 20, width: 120, height: 60,
        label: 'API', groupIds: ['group-1'], frameId: null,
        boundElements: [{ id: 'arrow-1', type: 'arrow' }],
        strokeColor: '#1e1e1e', backgroundColor: '#a5d8ff', fillStyle: 'solid',
        strokeWidth: 2, strokeStyle: 'dashed', roughness: 1, opacity: 80,
        link: 'https://example.com', points: [[0, 0], [120, 60]],
      }],
      appState: { viewBackgroundColor: '#ffffff', gridSize: 20, theme: 'light' },
    });
  });

  it('reads a fresh captured-session snapshot on every execution', async () => {
    let current = snapshot('first');
    const tools = new ExcalidrawToolset({ getSnapshot: () => current, applyPlan: vi.fn() }).definitions();
    const read = tools.find((tool) => tool.name === 'read_diagram')!;

    const first = await read.execute({});
    current = snapshot('second');
    const second = await read.execute({});

    expect(first.content).toContain('first');
    expect(second.content).toContain('second');
  });

  it('validates and delegates a complete plan once through the captured transaction', async () => {
    const applyPlan = vi.fn<(plan: DiagramPlanProposal) => Promise<void>>(async () => undefined);
    const tools = new ExcalidrawToolset({ getSnapshot: () => snapshot(), applyPlan }).definitions();
    const apply = tools.find((tool) => tool.name === 'apply_diagram_plan')!;
    const validated = apply.validate({ plan });

    await expect(apply.execute(validated)).resolves.toMatchObject({ mutationCommitted: true });
    expect(applyPlan).toHaveBeenCalledTimes(1);
    expect(applyPlan.mock.calls[0]?.[0]).toMatchObject(plan);
  });
});
