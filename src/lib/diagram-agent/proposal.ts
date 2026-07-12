import type { DiagramOperation, DiagramPlan, DiagramPlanProposal, DiagramTarget } from './types';

const PLAN_FENCE = /```(?:json|excalidraw-plan)?\s*([\s\S]*?)```/i;
const VALID_TARGETS = new Set<DiagramTarget['type']>(['current', 'path', 'new', 'tag', 'multiple']);
const VALID_OPERATIONS = new Set<DiagramOperation['type']>(['create', 'update', 'delete', 'style', 'group', 'order', 'align', 'appState']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseTarget(value: unknown): DiagramTarget | null {
  if (!isRecord(value) || typeof value.type !== 'string' || !VALID_TARGETS.has(value.type as DiagramTarget['type'])) return null;
  if (value.type === 'path' && (typeof value.path !== 'string' || !value.path.trim())) return null;
  if (value.type === 'tag' && (typeof value.tag !== 'string' || !value.tag.trim())) return null;
  const targetValue = value as Record<string, unknown>;
  const multipleTargets = targetValue.targets;
  if (value.type === 'multiple' && (!Array.isArray(multipleTargets) || multipleTargets.length === 0)) return null;
  if (value.type === 'multiple') {
    const targets = (multipleTargets as unknown[]).map(parseTarget);
    return targets.every((target): target is DiagramTarget => Boolean(target)) ? { type: 'multiple', targets } : null;
  }
  if (value.type === 'path' && typeof targetValue.path === 'string') return { type: 'path', path: targetValue.path.trim() };
  if (value.type === 'new') return { type: 'new', name: typeof targetValue.name === 'string' ? targetValue.name.trim() || undefined : undefined };
  if (value.type === 'tag' && typeof targetValue.tag === 'string') return { type: 'tag', tag: targetValue.tag.trim() };
  return { type: 'current' };
}

function parseOperation(value: unknown): DiagramOperation | null {
  if (!isRecord(value) || typeof value.type !== 'string' || !VALID_OPERATIONS.has(value.type as DiagramOperation['type'])) return null;
  if (value.type === 'create' && Array.isArray(value.elements)) return value as unknown as DiagramOperation;
  if (value.type === 'update' && typeof value.elementId === 'string' && isRecord(value.patch)) return value as unknown as DiagramOperation;
  if (['delete', 'style', 'group', 'order', 'align'].includes(value.type) && Array.isArray(value.elementIds)) return value as unknown as DiagramOperation;
  if (value.type === 'appState' && isRecord(value.patch)) return value as unknown as DiagramOperation;
  return null;
}

export function parseDiagramPlan(content: string): DiagramPlanProposal | null {
  const fencedContent = content.match(PLAN_FENCE)?.[1] ?? content;
  let candidate: unknown;
  try {
    candidate = JSON.parse(fencedContent.trim());
  } catch {
    return null;
  }

  if (!isRecord(candidate) || typeof candidate.summary !== 'string' || !Array.isArray(candidate.operations)) return null;
  const target = parseTarget(candidate.target ?? { type: 'current' });
  const operations = candidate.operations.map(parseOperation);
  if (!target || operations.length === 0 || !operations.every((operation): operation is DiagramOperation => Boolean(operation))) return null;

  return {
    id: `diagram-plan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    requestedAt: Date.now(),
    summary: candidate.summary.trim() || 'Apply diagram changes.',
    target,
    operations,
  };
}

export function describeDiagramPlan(plan: DiagramPlan) {
  const operationCounts = plan.operations.reduce<Record<string, number>>((counts, operation) => ({
    ...counts,
    [operation.type]: (counts[operation.type] ?? 0) + 1,
  }), {});
  const operations = Object.entries(operationCounts).map(([type, count]) => `${count} ${type}`).join(', ');
  const target = plan.target.type === 'path' ? `\`${plan.target.path}\`` : plan.target.type === 'new' ? `new file${plan.target.name ? ` \`${plan.target.name}\`` : ''}` : plan.target.type;
  return `**Diagram change applied**\n\n${plan.summary}\n\nTarget: ${target}\nOperations: ${operations}\n\nApplied directly to the opened Excalidraw file.`;
}
