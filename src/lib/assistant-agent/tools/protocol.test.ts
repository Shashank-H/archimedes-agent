import { describe, expect, it } from 'vitest';
import { parseModelEnvelope } from './protocol';

describe('parseModelEnvelope', () => {
  it('parses a strict tool call envelope', () => {
    expect(parseModelEnvelope(JSON.stringify({
      type: 'tool_calls',
      calls: [{ id: 'read-1', name: 'read_diagram', arguments: {} }],
    }))).toEqual({
      type: 'tool_calls',
      calls: [{ id: 'read-1', name: 'read_diagram', arguments: {} }],
    });
  });

  it('parses a fenced final envelope', () => {
    expect(parseModelEnvelope('```json\n{"type":"final","content":"Looks sound."}\n```'))
      .toEqual({ type: 'final', content: 'Looks sound.' });
  });

  it('rejects malformed and unsafe extra fields', () => {
    expect(parseModelEnvelope('{"type":"tool_calls","calls":[]}')).toBeNull();
    expect(parseModelEnvelope('{"type":"tool_calls","calls":[{"id":"x","name":"read_diagram","arguments":{},"unsafe":true}]}')).toBeNull();
    expect(parseModelEnvelope('{"type":"final","content":"ok","calls":[]}')).toBeNull();
  });
});
