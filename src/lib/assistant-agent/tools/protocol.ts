import type { FinalEnvelope, ModelEnvelope, ToolCall, ToolCallsEnvelope } from './types';

const JSON_FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function parseToolCall(value: unknown): ToolCall | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'name', 'arguments'])) return null;
  if (typeof value.id !== 'string' || !value.id.trim()) return null;
  if (typeof value.name !== 'string' || !value.name.trim()) return null;
  if (!isRecord(value.arguments)) return null;
  return { id: value.id.trim(), name: value.name.trim(), arguments: value.arguments };
}

function parseToolCalls(value: Record<string, unknown>): ToolCallsEnvelope | null {
  if (!hasOnlyKeys(value, ['type', 'calls']) || !Array.isArray(value.calls) || value.calls.length === 0) return null;
  const calls = value.calls.map(parseToolCall);
  if (!calls.every((call): call is ToolCall => Boolean(call))) return null;
  if (new Set(calls.map((call) => call.id)).size !== calls.length) return null;
  return { type: 'tool_calls', calls };
}

function parseFinal(value: Record<string, unknown>): FinalEnvelope | null {
  if (!hasOnlyKeys(value, ['type', 'content']) || typeof value.content !== 'string' || !value.content.trim()) return null;
  return { type: 'final', content: value.content.trim() };
}

export function parseModelEnvelope(content: string): ModelEnvelope | null {
  const candidate = content.trim().match(JSON_FENCE)?.[1] ?? content.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.type === 'tool_calls') return parseToolCalls(parsed);
  if (parsed.type === 'final') return parseFinal(parsed);
  return null;
}
