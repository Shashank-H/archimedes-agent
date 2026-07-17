export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type ToolCallsEnvelope = {
  type: 'tool_calls';
  calls: ToolCall[];
};

export type FinalEnvelope = {
  type: 'final';
  content: string;
};

export type ModelEnvelope = ToolCallsEnvelope | FinalEnvelope;

export type ToolAccess = 'read' | 'write';

export type ToolResult = {
  callId: string;
  name: string;
  ok: boolean;
  content: string;
  mutationCommitted?: boolean;
};
