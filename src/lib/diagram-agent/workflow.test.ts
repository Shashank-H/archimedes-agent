import { describe, expect, it, vi } from 'vitest';
import type { DiagramSnapshot } from '../../types';
import { DiagramAgentWorkflow } from './workflow';

function emptySnapshot(): DiagramSnapshot {
  return { elements: [], appState: {}, files: {}, updatedAt: Date.now() };
}

const validPlan = JSON.stringify({
  summary: 'Add a service box.',
  target: { type: 'current' },
  operations: [
    { type: 'create', elements: [{ type: 'rectangle', x: 20, y: 20, width: 160, height: 80, label: { text: 'API' } }] },
    { type: 'appState', patch: { viewBackgroundColor: '#ffffff' } },
  ],
});

describe('DiagramAgentWorkflow', () => {
  it('runs the LangGraph stages and applies operations incrementally', async () => {
    let snapshot = emptySnapshot();
    const applyPlan = vi.fn(async (plan) => {
      if (plan.operations[0]?.type === 'create') {
        snapshot = { ...snapshot, elements: [{ id: 'created', type: 'rectangle', isDeleted: false } as never], updatedAt: Date.now() };
      }
    });
    const steps: string[] = [];

    const result = await new DiagramAgentWorkflow().run('Draw an API service', {
      getSnapshot: () => snapshot,
      captureImage: async () => ({ base64: 'image', mimeType: 'image/png' }),
      complete: async () => validPlan,
      applyPlan,
      onStep: (step) => steps.push(`${step.id}:${step.status}`),
      signal: new AbortController().signal,
    });

    expect(applyPlan).toHaveBeenCalledTimes(2);
    expect(applyPlan.mock.calls.every(([plan]) => plan.operations.length === 1)).toBe(true);
    expect(result.plan.operations).toHaveLength(2);
    expect(steps).toContain('inspect:completed');
    expect(steps).toContain('verify:completed');
    expect(steps).toContain('respond:completed');
  });

  it('retries one malformed model plan before applying', async () => {
    let snapshot = emptySnapshot();
    const complete = vi.fn()
      .mockResolvedValueOnce('not json')
      .mockResolvedValueOnce(validPlan);

    await new DiagramAgentWorkflow().run('Draw an API service', {
      getSnapshot: () => snapshot,
      captureImage: async () => ({ base64: 'image', mimeType: 'image/png' }),
      complete,
      applyPlan: async (plan) => {
        if (plan.operations[0]?.type === 'create') snapshot = { ...snapshot, elements: [{ id: 'created', type: 'rectangle', isDeleted: false } as never] };
      },
      onStep: () => undefined,
      signal: new AbortController().signal,
    });

    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('does not call the model when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const complete = vi.fn();

    await expect(new DiagramAgentWorkflow().run('Draw', {
      getSnapshot: emptySnapshot,
      captureImage: async () => ({ base64: 'image', mimeType: 'image/png' }),
      complete,
      applyPlan: async () => undefined,
      onStep: () => undefined,
      signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' });
    expect(complete).not.toHaveBeenCalled();
  });
});
