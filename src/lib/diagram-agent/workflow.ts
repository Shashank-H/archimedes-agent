import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import type { DiagramSnapshot, LlmChatMessage, LlmImage } from '../../types';
import { describeDiagramPlan, parseDiagramPlan } from './proposal';
import type { DiagramPlanProposal } from './types';
import {
  describeOperation,
  DIAGRAM_AGENT_STEPS,
  DIAGRAM_AGENT_SYSTEM_PROMPT,
  MAX_PLAN_ATTEMPTS,
  type DiagramAgentStep,
  type DiagramAgentStepId,
} from './constants';

const State = Annotation.Root({
  request: Annotation<string>(),
  snapshot: Annotation<DiagramSnapshot | null>(),
  canvasImage: Annotation<LlmImage | null>(),
  initialElementCount: Annotation<number>(),
  brief: Annotation<string>(),
  plan: Annotation<DiagramPlanProposal | null>(),
  planAttempts: Annotation<number>(),
  finalResponse: Annotation<string>(),
});

type WorkflowState = typeof State.State;

export type DiagramAgentWorkflowDependencies = {
  getSnapshot: () => DiagramSnapshot | null;
  captureImage: (snapshot: DiagramSnapshot) => Promise<LlmImage>;
  complete: (messages: LlmChatMessage[], signal: AbortSignal) => Promise<string>;
  applyPlan: (plan: DiagramPlanProposal) => Promise<void>;
  onStep: (step: DiagramAgentStep) => void;
  signal: AbortSignal;
};

export type DiagramAgentWorkflowResult = {
  response: string;
  plan: DiagramPlanProposal;
  finalSnapshot: DiagramSnapshot;
};

function liveElementCount(snapshot: DiagramSnapshot | null) {
  return snapshot?.elements.filter((element) => !element.isDeleted).length ?? 0;
}

function formatScene(snapshot: DiagramSnapshot) {
  return JSON.stringify({
    elements: snapshot.elements.filter((element) => !element.isDeleted).map((element) => ({
      id: element.id,
      type: element.type,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      text: 'text' in element ? element.text : undefined,
      groupIds: element.groupIds,
    })),
    appState: snapshot.appState,
  });
}

/** LangGraph orchestration for inspect -> brief -> plan -> incremental apply -> verify -> respond. */
export class DiagramAgentWorkflow {
  async run(request: string, dependencies: DiagramAgentWorkflowDependencies): Promise<DiagramAgentWorkflowResult> {
    let currentStep: DiagramAgentStepId = 'inspect';
    const report = (id: DiagramAgentStepId, status: DiagramAgentStep['status'], detail?: string) => {
      if (status === 'running') currentStep = id;
      const definition = DIAGRAM_AGENT_STEPS.find((step) => step.id === id);
      dependencies.onStep({ id, label: definition?.label ?? id, status, detail });
    };
    const assertActive = () => {
      if (dependencies.signal.aborted) throw new DOMException('Diagram edit cancelled.', 'AbortError');
    };

    const graph = new StateGraph(State)
      .addNode('inspect', async () => {
        assertActive();
        report('inspect', 'running');
        const snapshot = dependencies.getSnapshot();
        if (!snapshot) throw new Error('The opened Excalidraw file is not ready.');
        const image = await dependencies.captureImage(snapshot);
        const count = liveElementCount(snapshot);
        report('inspect', 'completed', `${count} live element${count === 1 ? '' : 's'}`);
        return { snapshot, canvasImage: image, initialElementCount: count };
      })
      .addNode('prepareBrief', async (state: WorkflowState) => {
        assertActive();
        report('brief', 'running');
        const hasCanvas = state.initialElementCount > 0;
        const brief = `${hasCanvas ? 'Modify or extend the existing canvas' : 'Create a new diagram on the empty canvas'} to satisfy: ${state.request.trim()}`;
        report('brief', 'completed', hasCanvas ? 'Existing diagram edit' : 'New diagram');
        return { brief };
      })
      .addNode('planEdit', async (state: WorkflowState) => {
        assertActive();
        report('plan', 'running', state.planAttempts ? `Retry ${state.planAttempts}/${MAX_PLAN_ATTEMPTS - 1}` : undefined);
        if (!state.snapshot) throw new Error('Canvas inspection was lost before planning.');
        const retryInstruction = state.planAttempts > 0 ? 'Previous output was invalid. Return strict JSON matching the schema, with at least one fully specified operation.\n\n' : '';
        const content = await dependencies.complete([
          { role: 'system', content: DIAGRAM_AGENT_SYSTEM_PROMPT },
          { role: 'user', content: `${retryInstruction}${state.brief}\n\nCurrent canvas scene:\n${formatScene(state.snapshot)}`, images: state.canvasImage ? [state.canvasImage] : undefined },
        ], dependencies.signal);
        const plan = parseDiagramPlan(content);
        const attempts = state.planAttempts + 1;
        if (!plan) {
          if (attempts >= MAX_PLAN_ATTEMPTS) throw new Error('The model did not return a valid executable diagram plan after retrying. No changes were made.');
          report('plan', 'running', 'Invalid plan; retrying with strict JSON instructions');
          return { plan: null, planAttempts: attempts };
        }
        report('plan', 'completed', `${plan.operations.length} operation${plan.operations.length === 1 ? '' : 's'}`);
        return { plan: { ...plan, target: { type: 'current' } as const }, planAttempts: attempts };
      })
      .addNode('applyOperations', async (state: WorkflowState) => {
        assertActive();
        if (!state.plan) throw new Error('No validated diagram plan is available.');
        report('apply', 'running', `0/${state.plan.operations.length}`);
        for (const [index, operation] of state.plan.operations.entries()) {
          assertActive();
          await dependencies.applyPlan({ ...state.plan, operations: [operation] });
          report('apply', 'running', describeOperation(operation, index, state.plan.operations.length));
        }
        report('apply', 'completed', `${state.plan.operations.length}/${state.plan.operations.length} operations`);
        return {};
      })
      .addNode('verify', async (state: WorkflowState) => {
        assertActive();
        report('verify', 'running');
        const snapshot = dependencies.getSnapshot();
        if (!snapshot) throw new Error('Canvas became unavailable during verification.');
        const finalCount = liveElementCount(snapshot);
        if (state.plan?.operations.some((operation) => operation.type === 'create') && finalCount <= state.initialElementCount) {
          throw new Error('Verification failed: created elements were not visible on the active canvas.');
        }
        report('verify', 'completed', `${finalCount} live element${finalCount === 1 ? '' : 's'}`);
        return { snapshot };
      })
      .addNode('buildResponse', async (state: WorkflowState) => {
        assertActive();
        report('respond', 'running');
        if (!state.plan) throw new Error('The completed plan is unavailable.');
        const response = describeDiagramPlan(state.plan);
        report('respond', 'completed');
        return { finalResponse: response };
      })
      .addEdge(START, 'inspect')
      .addEdge('inspect', 'prepareBrief')
      .addEdge('prepareBrief', 'planEdit')
      .addConditionalEdges('planEdit', (state: WorkflowState) => state.plan ? 'applyOperations' : 'planEdit', ['applyOperations', 'planEdit'])
      .addEdge('applyOperations', 'verify')
      .addEdge('verify', 'buildResponse')
      .addEdge('buildResponse', END)
      .compile();

    try {
      const result = await graph.invoke({ request, snapshot: null, canvasImage: null, initialElementCount: 0, brief: '', plan: null, planAttempts: 0, finalResponse: '' }, { signal: dependencies.signal, recursionLimit: 16 });
      if (!result.plan || !result.snapshot) throw new Error('Diagram workflow completed without a plan or final canvas snapshot.');
      return { response: result.finalResponse, plan: result.plan, finalSnapshot: result.snapshot };
    } catch (error) {
      const active = DIAGRAM_AGENT_STEPS.find((step) => step.id === currentStep);
      if (active) dependencies.onStep({ ...active, status: 'failed', detail: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
}

export const diagramAgentWorkflow = new DiagramAgentWorkflow();
