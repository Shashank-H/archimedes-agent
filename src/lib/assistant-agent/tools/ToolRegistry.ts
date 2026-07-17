import type { AssistantIntent } from '../types';
import type { ToolAccess, ToolCall, ToolResult } from './types';

export type AssistantToolExecution = {
  content: string;
  mutationCommitted?: boolean;
};

export type AssistantToolDefinition = {
  name: string;
  description: string;
  access: ToolAccess;
  inputSchema: Record<string, unknown>;
  validate: (argumentsValue: Record<string, unknown>) => Record<string, unknown>;
  execute: (argumentsValue: Record<string, unknown>) => Promise<AssistantToolExecution>;
};

const WRITE_INTENTS = new Set<AssistantIntent>(['edit', 'review_edit']);

/** Marks execution failures that must terminate the workflow (for example persistence rollback). */
export class FatalToolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FatalToolError';
  }
}

export class ToolRegistry {
  private readonly definitions = new Map<string, AssistantToolDefinition>();

  constructor(definitions: AssistantToolDefinition[] = []) {
    for (const definition of definitions) this.register(definition);
  }

  register(definition: AssistantToolDefinition) {
    if (!definition.name.trim()) throw new Error('Tool names cannot be empty.');
    if (this.definitions.has(definition.name)) throw new Error(`Tool ${definition.name} is already registered.`);
    this.definitions.set(definition.name, definition);
    return this;
  }

  manifest(intent: AssistantIntent) {
    const tools = [...this.definitions.values()]
      .filter((definition) => definition.access === 'read' || WRITE_INTENTS.has(intent))
      .map(({ name, description, access, inputSchema }) => ({ name, description, access, inputSchema }));
    return JSON.stringify(tools, null, 2);
  }

  async execute(call: ToolCall, intent: AssistantIntent): Promise<ToolResult> {
    const definition = this.definitions.get(call.name);
    if (!definition) return this.error(call, `Unknown tool \`${call.name}\`.`);
    if (definition.access === 'write' && !WRITE_INTENTS.has(intent)) {
      return this.error(call, `Tool \`${call.name}\` is not allowed for ${intent} requests.`);
    }

    try {
      const argumentsValue = definition.validate(call.arguments);
      const result = await definition.execute(argumentsValue);
      return {
        callId: call.id,
        name: call.name,
        ok: true,
        content: result.content,
        mutationCommitted: result.mutationCommitted,
      };
    } catch (error) {
      if (error instanceof FatalToolError || (error instanceof DOMException && error.name === 'AbortError')) throw error;
      return this.error(call, error instanceof Error ? error.message : String(error));
    }
  }

  private error(call: ToolCall, content: string): ToolResult {
    return { callId: call.id, name: call.name, ok: false, content };
  }
}
