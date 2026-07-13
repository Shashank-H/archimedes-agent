export const THINKING_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const ASSISTANT_EMPTY_STATE = {
  kicker: 'Diagram-aware agent',
  title: 'Ask, review, build — in one conversation.',
  description: 'Archimedes understands each request and chooses the right LangGraph workflow. Ask a question, request a review, edit the diagram, or combine them.',
} as const;
