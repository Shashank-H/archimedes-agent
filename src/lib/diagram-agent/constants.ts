import type { DiagramOperation } from './types';

export type DiagramAgentStepId = 'inspect' | 'brief' | 'plan' | 'apply' | 'verify' | 'respond';
export type DiagramAgentStepStatus = 'pending' | 'running' | 'completed' | 'failed';

export type DiagramAgentStep = {
  id: DiagramAgentStepId;
  label: string;
  status: DiagramAgentStepStatus;
  detail?: string;
};

export const DIAGRAM_AGENT_STEPS: ReadonlyArray<Omit<DiagramAgentStep, 'status'>> = [
  { id: 'inspect', label: 'Inspect canvas' },
  { id: 'brief', label: 'Prepare drawing brief' },
  { id: 'plan', label: 'Plan edit' },
  { id: 'apply', label: 'Apply elements' },
  { id: 'verify', label: 'Verify canvas' },
  { id: 'respond', label: 'Summarize result' },
];

export const MAX_PLAN_ATTEMPTS = 2;

export const DIAGRAM_AGENT_SYSTEM_PROMPT = `You are Archimedes, an autonomous diagram editing agent. Return ONLY one JSON diagram plan; no markdown fence and no commentary.

Schema:
{"summary":"short description","target":{"type":"current"},"operations":[...]}

Allowed operations:
- {"type":"create","elements":[ExcalidrawElementSkeleton,...]}
- {"type":"update","elementId":"existing-id","patch":{"x":0,"y":0,"width":100,"height":50,"text":"..."}}
- {"type":"delete","elementIds":["existing-id"]}
- {"type":"style","elementIds":["existing-id"],"patch":{"strokeColor":"#...","backgroundColor":"#...","fillStyle":"solid"}}
- {"type":"group","elementIds":["existing-id"]}
- {"type":"order","elementIds":["existing-id"],"position":"front"}
- {"type":"align","elementIds":["existing-id"],"axis":"left"}
- {"type":"appState","patch":{"viewBackgroundColor":"#..."}}

For create, use Excalidraw skeletons such as rectangle, ellipse, diamond, text, arrow, and line. Keep coordinates finite, sizes positive, labels concise, and diagrams readable. Prefer a coherent left-to-right or top-to-bottom layout. Use existing IDs exactly when editing. Make the requested change directly; do not ask for confirmation.`;

export function describeOperation(operation: DiagramOperation, index: number, total: number) {
  const subject = operation.type === 'create'
    ? `${operation.elements.length} element${operation.elements.length === 1 ? '' : 's'}`
    : 'elementIds' in operation
      ? `${operation.elementIds.length} element${operation.elementIds.length === 1 ? '' : 's'}`
      : operation.type === 'update' ? `element ${operation.elementId}` : 'canvas settings';
  return `${index + 1}/${total}: ${operation.type} ${subject}`;
}
