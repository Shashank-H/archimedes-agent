import type { LlmChatMessage } from '../../types';
import type { AssistantToolDefinition } from './tools/ToolRegistry';

export type AssistantIntent = 'chat' | 'review' | 'edit' | 'review_edit' | 'proactive_review';

export type AssistantWorkflowStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  detail?: string;
};

export type AssistantWorkflowDependencies = {
  complete: (messages: LlmChatMessage[], signal: AbortSignal) => Promise<string>;
  buildMessages: (intent: AssistantIntent, request: string) => Promise<LlmChatMessage[]>;
  tools: AssistantToolDefinition[];
  hasDiagram: boolean;
  signal: AbortSignal;
  onStep: (step: AssistantWorkflowStep) => void;
};

export type AssistantWorkflowOptions = {
  intent?: AssistantIntent;
  maxToolTurns?: number;
};

export type AssistantWorkflowResult = {
  intent: AssistantIntent;
  response: string;
};
