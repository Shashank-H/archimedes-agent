import { describe, expect, it, vi } from 'vitest';
import { AssistantWorkflow } from './workflow';
import type { AssistantIntent } from './types';

function dependencies(outputs: string[]) {
  const complete = vi.fn(async () => outputs.shift() ?? '');
  const runEdit = vi.fn(async (request: string) => `Edited: ${request}`);
  const buildMessages = vi.fn(async (intent: AssistantIntent, request: string) => [
    { role: 'user' as const, content: `${intent}:${request}` },
  ]);
  return {
    complete,
    runEdit,
    buildMessages,
    hasDiagram: true,
    signal: new AbortController().signal,
    onStep: vi.fn(),
  };
}

describe('AssistantWorkflow', () => {
  it('routes a conversational request through the chat graph', async () => {
    const deps = dependencies(['{"intent":"chat"}', 'Architecture answer']);

    const result = await new AssistantWorkflow().run('What is a queue?', deps);

    expect(result.intent).toBe('chat');
    expect(result.response).toBe('Architecture answer');
    expect(deps.buildMessages).toHaveBeenCalledWith('chat', 'What is a queue?', undefined);
    expect(deps.runEdit).not.toHaveBeenCalled();
  });

  it('routes an edit request through the diagram-edit subgraph', async () => {
    const deps = dependencies(['{"intent":"edit"}']);

    const result = await new AssistantWorkflow().run('Add a cache', deps);

    expect(result.intent).toBe('edit');
    expect(deps.runEdit).toHaveBeenCalledWith('Add a cache', undefined);
    expect(result.response).toBe('Edited: Add a cache');
  });

  it('composes review and edit graphs for review-and-fix requests', async () => {
    const deps = dependencies(['{"intent":"review_edit"}', 'The API needs a cache.']);

    const result = await new AssistantWorkflow().run('Review this and fix the bottlenecks', deps);

    expect(result.intent).toBe('review_edit');
    expect(deps.buildMessages).toHaveBeenCalledWith('review', 'Review this and fix the bottlenecks', undefined);
    expect(deps.runEdit).toHaveBeenCalledWith('Review this and fix the bottlenecks', 'The API needs a cache.');
    expect(result.response).toContain('The API needs a cache.');
    expect(result.response).toContain('Edited:');
  });

  it('uses a safe heuristic fallback when classification is malformed', async () => {
    const deps = dependencies(['not-json']);

    const result = await new AssistantWorkflow().run('Please review the diagram', deps);

    expect(result.intent).toBe('review');
    expect(deps.buildMessages).toHaveBeenCalledWith('review', 'Please review the diagram', undefined);
  });

  it('routes proactive reviews through the same graph without classification', async () => {
    const deps = dependencies(['One concise observation']);

    const result = await new AssistantWorkflow().run('Review the latest diagram change.', deps, { intent: 'proactive_review' });

    expect(result.intent).toBe('proactive_review');
    expect(deps.complete).toHaveBeenCalledTimes(1);
    expect(deps.buildMessages).toHaveBeenCalledWith('proactive_review', 'Review the latest diagram change.', undefined);
  });

  it('stops before classification when already cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const deps = { ...dependencies([]), signal: controller.signal };

    await expect(new AssistantWorkflow().run('Review this', deps)).rejects.toMatchObject({ name: 'AbortError' });
    expect(deps.complete).not.toHaveBeenCalled();
    expect(deps.runEdit).not.toHaveBeenCalled();
  });

  it('rejects diagram-dependent routes when no diagram is open', async () => {
    const deps = { ...dependencies(['{"intent":"edit"}']), hasDiagram: false };

    await expect(new AssistantWorkflow().run('Add a cache', deps)).rejects.toThrow('Open an Excalidraw file');
    expect(deps.runEdit).not.toHaveBeenCalled();
  });
});
