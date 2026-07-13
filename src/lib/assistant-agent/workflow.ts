import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ASSISTANT_ROUTER_PROMPT, DIAGRAM_INTENTS } from './constants';
import { inferAssistantIntent, parseAssistantIntent } from './router';
import type {
  AssistantIntent,
  AssistantWorkflowDependencies,
  AssistantWorkflowResult,
  AssistantWorkflowStep,
} from './types';

const State = Annotation.Root({
  request: Annotation<string>(),
  intent: Annotation<AssistantIntent>(),
  review: Annotation<string>(),
  response: Annotation<string>(),
});

type WorkflowState = typeof State.State;

export class AssistantWorkflow {
  async run(
    request: string,
    dependencies: AssistantWorkflowDependencies,
    options: { intent?: AssistantIntent } = {},
  ): Promise<AssistantWorkflowResult> {
    let activeStep = 'route';
    const report = (id: string, label: string, status: AssistantWorkflowStep['status'], detail?: string) => {
      if (status === 'running') activeStep = id;
      dependencies.onStep({ id, label, status, detail });
    };
    const assertActive = () => {
      if (dependencies.signal.aborted) throw new DOMException('Assistant request cancelled.', 'AbortError');
    };

    const graph = new StateGraph(State)
      .addNode('route', async (state: WorkflowState) => {
        assertActive();
        report('route', 'Understanding request', 'running');
        let intent = options.intent;
        if (!intent) {
          const classification = await dependencies.complete([
            { role: 'system', content: ASSISTANT_ROUTER_PROMPT },
            { role: 'user', content: state.request },
          ], dependencies.signal);
          intent = parseAssistantIntent(classification) ?? inferAssistantIntent(state.request);
        }
        report('route', 'Understanding request', 'completed', intent.replace(/_/g, ' '));
        return { intent };
      })
      .addNode('inspect', async () => {
        assertActive();
        report('inspect', 'Inspecting diagram', 'running');
        if (!dependencies.hasDiagram) throw new Error('Open an Excalidraw file before asking Archimedes to review or change a diagram.');
        report('inspect', 'Inspecting diagram', 'completed');
        return {};
      })
      .addNode('chat', async (state: WorkflowState) => {
        assertActive();
        report('respond', 'Preparing response', 'running');
        const messages = await dependencies.buildMessages('chat', state.request, undefined);
        const response = await dependencies.complete(messages, dependencies.signal);
        return { response };
      })
      .addNode('reviewDiagram', async (state: WorkflowState) => {
        assertActive();
        report('review', 'Reviewing design', 'running');
        const reviewIntent = state.intent === 'review_edit' ? 'review' : state.intent;
        const messages = await dependencies.buildMessages(reviewIntent, state.request, undefined);
        const review = await dependencies.complete(messages, dependencies.signal);
        report('review', 'Reviewing design', 'completed');
        return state.intent === 'review_edit' ? { review } : { review, response: review };
      })
      .addNode('edit', async (state: WorkflowState) => {
        assertActive();
        report('edit', 'Updating diagram', 'running');
        const editResponse = await dependencies.runEdit(state.request, state.review || undefined);
        report('edit', 'Updating diagram', 'completed');
        return {
          response: state.review
            ? `### Review\n${state.review}\n\n### Changes applied\n${editResponse}`
            : editResponse,
        };
      })
      .addNode('respond', async (state: WorkflowState) => {
        assertActive();
        report('respond', 'Preparing response', 'completed');
        return { response: state.response };
      })
      .addEdge(START, 'route')
      .addConditionalEdges('route', (state: WorkflowState) => DIAGRAM_INTENTS.has(state.intent) ? 'inspect' : 'chat', ['inspect', 'chat'])
      .addConditionalEdges('inspect', (state: WorkflowState) => state.intent === 'edit' ? 'edit' : 'reviewDiagram', ['edit', 'reviewDiagram'])
      .addConditionalEdges('reviewDiagram', (state: WorkflowState) => state.intent === 'review_edit' ? 'edit' : 'respond', ['edit', 'respond'])
      .addEdge('chat', 'respond')
      .addEdge('edit', 'respond')
      .addEdge('respond', END)
      .compile();

    try {
      const result = await graph.invoke(
        { request, intent: options.intent ?? 'chat', review: '', response: '' },
        { signal: dependencies.signal, recursionLimit: 12 },
      );
      return { intent: result.intent, response: result.response, review: result.review || undefined };
    } catch (error) {
      dependencies.onStep({
        id: activeStep,
        label: activeStep === 'route' ? 'Understanding request' : activeStep,
        status: 'failed',
        detail: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const assistantWorkflow = new AssistantWorkflow();
