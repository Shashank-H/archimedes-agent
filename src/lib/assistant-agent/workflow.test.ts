import { describe, expect, it, vi } from 'vitest';
import type { LlmChatMessage } from '../../types';
import type { AssistantToolDefinition } from './tools/ToolRegistry';
import { AssistantWorkflow } from './workflow';

const envelope = (value: unknown) => JSON.stringify(value);
const calls = (...values: Array<{ id: string; name: string; arguments?: Record<string, unknown> }>) => envelope({
  type: 'tool_calls', calls: values.map((value) => ({ ...value, arguments: value.arguments ?? {} })),
});
const final = (content: string) => envelope({ type: 'final', content });

function tool(name: string, access: 'read' | 'write' = 'read', content = `${name} result`): AssistantToolDefinition {
  return {
    name, description: `${name} description`, access,
    inputSchema: { type: 'object', additionalProperties: false },
    validate: (argumentsValue) => argumentsValue,
    execute: vi.fn(async () => ({ content, mutationCommitted: access === 'write' })),
  };
}

function dependencies(outputs: string[], tools: AssistantToolDefinition[] = []) {
  const complete = vi.fn<(messages: LlmChatMessage[]) => Promise<string>>(async () => outputs.shift() ?? '');
  return {
    complete,
    tools,
    buildMessages: vi.fn(async () => [{ role: 'user' as const, content: 'base context' }]),
    hasDiagram: true,
    signal: new AbortController().signal,
    onStep: vi.fn(),
  };
}

describe('AssistantWorkflow provider-neutral tool supervisor', () => {
  it('lets plain chat finish without a diagram or tool call', async () => {
    const deps = { ...dependencies(['{"intent":"chat"}', 'Architecture answer']), hasDiagram: false };

    const result = await new AssistantWorkflow().run('What is a queue?', deps);

    expect(result).toMatchObject({ intent: 'chat', response: 'Architecture answer' });
    expect(deps.complete).toHaveBeenCalledTimes(2);
  });

  it('runs review through read_diagram before accepting a final response', async () => {
    const read = tool('read_diagram');
    const deps = dependencies(['{"intent":"review"}', calls({ id: 'read-1', name: 'read_diagram' }), final('Use clearer boundaries.')], [read]);

    const result = await new AssistantWorkflow().run('Review this diagram', deps);

    expect(read.execute).toHaveBeenCalledTimes(1);
    expect(result.response).toBe('Use clearer boundaries.');
    expect(deps.complete.mock.calls[1]?.[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'system', content: expect.stringContaining('untrusted data') }),
    ]));
    expect(deps.complete.mock.calls[2]?.[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'user', content: expect.stringContaining('read_diagram result') }),
    ]));
  });

  it('supports empty-canvas creation through schema, read, and one atomic apply', async () => {
    const schema = tool('read_excalidraw_schema');
    const read = tool('read_diagram');
    const apply = tool('apply_diagram_plan', 'write');
    const deps = dependencies([
      '{"intent":"edit"}',
      calls(
        { id: 'schema-1', name: 'read_excalidraw_schema' },
        { id: 'read-1', name: 'read_diagram' },
      ),
      calls({ id: 'apply-1', name: 'apply_diagram_plan', arguments: { plan: {} } }),
      final('Created the diagram.'),
    ], [schema, read, apply]);

    const result = await new AssistantWorkflow().run('Create a queue architecture', deps);

    expect(schema.execute).toHaveBeenCalledTimes(1);
    expect(read.execute).toHaveBeenCalledTimes(1);
    expect(apply.execute).toHaveBeenCalledTimes(1);
    expect(result.response).toBe('Created the diagram.');
  });

  it('keeps review_edit critique and mutation in one composed tool transcript', async () => {
    const schema = tool('read_excalidraw_schema');
    const read = tool('read_diagram', 'read', 'scene');
    const apply = tool('apply_diagram_plan', 'write', 'saved');
    const deps = dependencies([
      '{"intent":"review_edit"}',
      calls(
        { id: 'schema-1', name: 'read_excalidraw_schema' },
        { id: 'read-1', name: 'read_diagram' },
      ),
      calls({ id: 'apply-1', name: 'apply_diagram_plan', arguments: { plan: {} } }),
      final('Review: cache missing. Change: cache added.'),
    ], [schema, read, apply]);

    const result = await new AssistantWorkflow().run('Review and improve this', deps);

    expect(result.response).toContain('Review:');
    expect(apply.execute).toHaveBeenCalledTimes(1);
    expect(deps.complete.mock.calls[3]?.[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ content: expect.stringContaining('scene') }),
      expect.objectContaining({ content: expect.stringContaining('saved') }),
    ]));
  });

  it('uses the malformed-router fallback and forced proactive route', async () => {
    const read = tool('read_diagram');
    const malformed = dependencies(['not-json', calls({ id: 'read-1', name: 'read_diagram' }), final('reviewed')], [read]);
    expect((await new AssistantWorkflow().run('Please review the diagram', malformed)).intent).toBe('review');

    const proactive = dependencies([calls({ id: 'read-2', name: 'read_diagram' }), final('proactive note')], [read]);
    const result = await new AssistantWorkflow().run('Review latest change', proactive, { intent: 'proactive_review' });
    expect(result.intent).toBe('proactive_review');
    expect(proactive.complete).toHaveBeenCalledTimes(2);
  });

  it('feeds unknown and invalid tool errors back for model correction', async () => {
    const read = tool('read_diagram');
    const deps = dependencies([
      '{"intent":"review"}',
      calls({ id: 'bad-1', name: 'missing' }),
      calls({ id: 'read-1', name: 'read_diagram' }),
      final('Corrected review.'),
    ], [read]);

    await new AssistantWorkflow().run('Review it', deps);

    expect(deps.complete.mock.calls[2]?.[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ content: expect.stringContaining('Unknown tool') }),
    ]));
    expect(read.execute).toHaveBeenCalledTimes(1);
  });

  it('requires schema and scene reads in an earlier model turn before mutation', async () => {
    const schema = tool('read_excalidraw_schema');
    const read = tool('read_diagram');
    const apply = tool('apply_diagram_plan', 'write');
    const deps = dependencies([
      '{"intent":"edit"}',
      calls({ id: 'early-write', name: 'apply_diagram_plan', arguments: { plan: {} } }),
      calls(
        { id: 'schema-1', name: 'read_excalidraw_schema' },
        { id: 'read-1', name: 'read_diagram' },
      ),
      calls({ id: 'apply-1', name: 'apply_diagram_plan', arguments: { plan: {} } }),
      final('Created safely.'),
    ], [schema, read, apply]);

    const result = await new AssistantWorkflow().run('Create a diagram', deps);

    expect(result.response).toBe('Created safely.');
    expect(apply.execute).toHaveBeenCalledTimes(1);
    expect(deps.complete.mock.calls[2]?.[0]).toEqual(expect.arrayContaining([
      expect.objectContaining({ content: expect.stringContaining('must run in an earlier model turn') }),
    ]));
  });

  it('rejects mutation finals without a committed write and enforces max turns', async () => {
    const deps = dependencies(['{"intent":"edit"}', final('Done without a tool'), final('Still done')]);

    await expect(new AssistantWorkflow().run('Change it', deps, { maxToolTurns: 2 }))
      .rejects.toThrow(/tool turn limit/i);
  });

  it('rejects diagram routes without a diagram and cancellation before classification', async () => {
    const missing = { ...dependencies(['{"intent":"edit"}']), hasDiagram: false };
    await expect(new AssistantWorkflow().run('Add a cache', missing)).rejects.toThrow('Open an Excalidraw file');

    const controller = new AbortController();
    controller.abort();
    const cancelled = { ...dependencies([]), signal: controller.signal };
    await expect(new AssistantWorkflow().run('Review this', cancelled)).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancelled.complete).not.toHaveBeenCalled();
  });

  it('reports stable namespaced route, model, tool, and final steps', async () => {
    const read = tool('read_diagram');
    const deps = dependencies(['{"intent":"review"}', calls({ id: 'r1', name: 'read_diagram' }), final('ok')], [read]);
    await new AssistantWorkflow().run('Review', deps);

    const ids = deps.onStep.mock.calls.map(([step]) => step.id);
    expect(ids).toEqual(expect.arrayContaining(['route', 'model:1', 'tool:read_diagram:r1', 'final']));
  });
});
