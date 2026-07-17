import { describe, expect, it, vi } from 'vitest';
import { FatalToolError, ToolRegistry } from './ToolRegistry';
import type { AssistantToolDefinition } from './ToolRegistry';

function tool(name: string, access: 'read' | 'write' = 'read'): AssistantToolDefinition {
  return {
    name,
    description: `${name} description`,
    access,
    inputSchema: { type: 'object', additionalProperties: false },
    validate: (args) => args,
    execute: vi.fn(async () => ({ content: 'ok', mutationCommitted: access === 'write' })),
  };
}

describe('ToolRegistry', () => {
  it('builds a stable manifest and executes a registered read tool', async () => {
    const registry = new ToolRegistry([tool('read_diagram')]);

    expect(registry.manifest('review')).toContain('read_diagram');
    await expect(registry.execute({ id: '1', name: 'read_diagram', arguments: {} }, 'review'))
      .resolves.toMatchObject({ callId: '1', name: 'read_diagram', ok: true, content: 'ok' });
  });

  it('returns structured errors for unknown tools and invalid arguments', async () => {
    const invalid = tool('read_diagram');
    invalid.validate = () => { throw new Error('bad arguments'); };
    const registry = new ToolRegistry([invalid]);

    await expect(registry.execute({ id: '1', name: 'missing', arguments: {} }, 'review'))
      .resolves.toMatchObject({ ok: false, content: expect.stringContaining('Unknown tool') });
    await expect(registry.execute({ id: '2', name: 'read_diagram', arguments: {} }, 'review'))
      .resolves.toMatchObject({ ok: false, content: 'bad arguments' });
  });

  it('forbids write tools outside edit-capable intents', async () => {
    const definition = tool('apply_diagram_plan', 'write');
    const registry = new ToolRegistry([definition]);

    await expect(registry.execute({ id: '1', name: definition.name, arguments: {} }, 'proactive_review'))
      .resolves.toMatchObject({ ok: false, content: expect.stringContaining('not allowed') });
    await expect(registry.execute({ id: '2', name: definition.name, arguments: {} }, 'edit'))
      .resolves.toMatchObject({ ok: true, mutationCommitted: true });
  });

  it('propagates fatal transaction failures instead of asking the model to retry', async () => {
    const definition = tool('apply_diagram_plan', 'write');
    definition.execute = async () => { throw new FatalToolError('save failed'); };
    const registry = new ToolRegistry([definition]);

    await expect(registry.execute({ id: '1', name: definition.name, arguments: {} }, 'edit'))
      .rejects.toThrow('save failed');
  });
});
