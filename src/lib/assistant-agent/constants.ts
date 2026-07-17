import type { AssistantIntent } from './types';

export const ASSISTANT_ROUTER_PROMPT = `Classify the user's request for a diagram-aware architecture assistant.
Return only JSON: {"intent":"chat|review|edit|review_edit"}.
- chat: discuss, explain, answer, brainstorm, or ask a clarifying question without evaluating or changing the diagram
- review: critique, analyze, audit, validate, or suggest improvements without changing the diagram
- edit: create, draw, add, remove, rename, style, rearrange, or otherwise mutate the diagram
- review_edit: inspect/review and then apply improvements or fixes
Choose review_edit when the user asks to both assess and change the diagram.`;

export const DIAGRAM_INTENTS = new Set<AssistantIntent>(['review', 'edit', 'review_edit', 'proactive_review']);
