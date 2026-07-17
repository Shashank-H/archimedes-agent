import type { DiagramSnapshot } from '../../../types';
import { parseDiagramPlan } from '../../diagram-agent/proposal';
import type { DiagramPlanProposal } from '../../diagram-agent/types';
import { FatalToolError, type AssistantToolDefinition } from './ToolRegistry';

export type ExcalidrawToolSession = {
  getSnapshot: () => DiagramSnapshot | null;
  applyPlan: (plan: DiagramPlanProposal) => Promise<void>;
};

const SCHEMA_GUIDANCE = {
  target: { type: 'current' },
  plan: {
    summary: 'Short description of the complete change',
    operations: [
      { type: 'create', elements: ['ExcalidrawElementSkeleton'] },
      { type: 'update', elementId: 'existing-id', patch: { x: 0, y: 0, width: 100, height: 50, text: 'label' } },
      { type: 'delete', elementIds: ['existing-id'] },
      { type: 'style', elementIds: ['existing-id'], patch: { strokeColor: '#000000', backgroundColor: '#ffffff' } },
      { type: 'group', elementIds: ['existing-id'] },
      { type: 'order', elementIds: ['existing-id'], position: 'front|back' },
      { type: 'align', elementIds: ['existing-id'], axis: 'left|center|right|top|middle|bottom' },
      { type: 'appState', patch: { viewBackgroundColor: '#ffffff', gridSize: 20, theme: 'light|dark' } },
    ],
  },
  guidance: [
    'Read the diagram before editing an existing scene.',
    'Submit one complete plan. The application validates the full plan, commits atomically, and saves once.',
    'Use existing element IDs exactly. Coordinates must be finite and dimensions positive.',
  ],
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: string[]) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(`Unsupported arguments: ${extras.join(', ')}.`);
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined;
}

export function normalizeDiagramSnapshot(snapshot: DiagramSnapshot) {
  return {
    elements: snapshot.elements
      .filter((element) => !element.isDeleted)
      .map((element) => {
        const candidate = element as unknown as Record<string, unknown>;
        const label = record(candidate.label) ? optionalString(candidate.label.text) : undefined;
        return {
          id: element.id,
          type: element.type,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          angle: element.angle,
          text: optionalString(candidate.text),
          label,
          strokeColor: optionalString(candidate.strokeColor),
          backgroundColor: optionalString(candidate.backgroundColor),
          fillStyle: optionalString(candidate.fillStyle),
          strokeWidth: typeof candidate.strokeWidth === 'number' ? candidate.strokeWidth : undefined,
          strokeStyle: optionalString(candidate.strokeStyle),
          roughness: typeof candidate.roughness === 'number' ? candidate.roughness : undefined,
          opacity: typeof candidate.opacity === 'number' ? candidate.opacity : undefined,
          link: optionalString(candidate.link),
          points: Array.isArray(candidate.points) ? candidate.points : undefined,
          groupIds: element.groupIds,
          frameId: candidate.frameId ?? null,
          containerId: candidate.containerId ?? null,
          boundElements: Array.isArray(candidate.boundElements)
            ? candidate.boundElements.map((binding) => record(binding) ? { id: binding.id, type: binding.type } : binding)
            : [],
          startBinding: candidate.startBinding ?? null,
          endBinding: candidate.endBinding ?? null,
        };
      }),
    appState: {
      viewBackgroundColor: snapshot.appState.viewBackgroundColor,
      gridSize: snapshot.appState.gridSize,
      theme: snapshot.appState.theme,
    },
    updatedAt: snapshot.updatedAt,
  };
}

export class ExcalidrawToolset {
  constructor(private readonly session: ExcalidrawToolSession) {}

  definitions(): AssistantToolDefinition[] {
    return [
      {
        name: 'read_excalidraw_schema',
        description: 'Read the supported Excalidraw plan and operation contract before creating or changing a diagram.',
        access: 'read',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        validate: (argumentsValue) => {
          assertOnlyKeys(argumentsValue, []);
          return {};
        },
        execute: async () => ({ content: JSON.stringify(SCHEMA_GUIDANCE) }),
      },
      {
        name: 'read_diagram',
        description: 'Read a fresh compact normalized snapshot of the captured target diagram.',
        access: 'read',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        validate: (argumentsValue) => {
          assertOnlyKeys(argumentsValue, []);
          return {};
        },
        execute: async () => {
          const snapshot = this.session.getSnapshot();
          if (!snapshot) throw new Error('The captured target diagram is no longer available.');
          return { content: JSON.stringify(normalizeDiagramSnapshot(snapshot)) };
        },
      },
      {
        name: 'apply_diagram_plan',
        description: 'Validate, preflight, atomically commit, and save one complete diagram plan to the captured target.',
        access: 'write',
        inputSchema: {
          type: 'object',
          required: ['plan'],
          properties: { plan: { type: 'object' } },
          additionalProperties: false,
        },
        validate: (argumentsValue) => {
          assertOnlyKeys(argumentsValue, ['plan']);
          if (!record(argumentsValue.plan)) throw new Error('apply_diagram_plan requires a plan object.');
          const plan = parseDiagramPlan(JSON.stringify(argumentsValue.plan));
          if (!plan) throw new Error('The diagram plan does not match the supported operation contract.');
          if (plan.target.type !== 'current') throw new Error('Only the captured current diagram target is supported.');
          return { plan };
        },
        execute: async (argumentsValue) => {
          const plan = argumentsValue.plan as DiagramPlanProposal;
          try {
            await this.session.applyPlan(plan);
          } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') throw error;
            throw new FatalToolError(error instanceof Error ? error.message : String(error));
          }
          return { content: `Committed and saved: ${plan.summary}`, mutationCommitted: true };
        },
      },
    ];
  }
}
