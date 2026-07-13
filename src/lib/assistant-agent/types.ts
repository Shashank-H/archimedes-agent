import type { LlmChatMessage } from '../../types';

export type AssistantIntent = 'chat' | 'review' | 'edit' | 'review_edit' | 'proactive_review';

export type AssistantWorkflowStep = {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  detail?: string;
};

export type AssistantWorkflowDependencies = {
  complete: (messages: LlmChatMessage[], signal: AbortSignal) => Promise<string>;
  buildMessages: (intent: AssistantIntent, request: string, review?: string) => Promise<LlmChatMessage[]>;
  runEdit: (request: string, review?: string) => Promise<string>;
  hasDiagram: boolean;
  signal: AbortSignal;
  onStep: (step: AssistantWorkflowStep) => void;
};

export type AssistantWorkflowResult = {
  intent: AssistantIntent;
  response: string;
  review?: string;
};
