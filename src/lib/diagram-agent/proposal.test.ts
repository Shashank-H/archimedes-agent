import { describe, expect, it } from 'vitest';
import { parseDiagramPlan } from './proposal';

describe('parseDiagramPlan', () => {
  it('accepts a fenced current-canvas plan', () => {
    const plan = parseDiagramPlan('```json\n{"summary":"Move it","target":{"type":"current"},"operations":[{"type":"update","elementId":"node-1","patch":{"x":20}}]}\n```');
    expect(plan?.operations[0]?.type).toBe('update');
  });

  it.each([
    { type: 'create', elements: [] },
    { type: 'delete', elementIds: [] },
    { type: 'order', elementIds: ['a'], position: 'sideways' },
    { type: 'align', elementIds: ['a'], axis: 'diagonal' },
    { type: 'style', elementIds: ['a'] },
  ])('rejects malformed operation $type', (operation) => {
    expect(parseDiagramPlan(JSON.stringify({ summary: 'bad', target: { type: 'current' }, operations: [operation] }))).toBeNull();
  });
});
