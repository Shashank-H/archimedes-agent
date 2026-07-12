import type { AssistantMode } from '../../types';

export const THINKING_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const CHAT_SECTION_TABS: ReadonlyArray<{ id: AssistantMode; label: string }> = [
  { id: 'chat', label: 'Chat' },
  { id: 'review', label: 'Review' },
  { id: 'edit', label: 'Edit / Build' },
];

export type ChatSectionTab = AssistantMode;

export const CHAT_EMPTY_STATES = {
  chat: {
    kicker: 'Diagram-aware chat',
    title: 'Ask Archimedes about the opened diagram.',
    description: 'Discuss architecture, tradeoffs, security, scalability, or implementation without changing the canvas.',
  },
  review: {
    kicker: 'No review yet',
    title: 'Draw a system design, then ask Archimedes for a review.',
    description: 'Switch to proactive mode for automatic diagram reviews, or keep manual mode and trigger review from the composer.',
  },
  edit: {
    kicker: 'Agentic editing ready',
    title: 'Open an Excalidraw file, then describe what to build or change.',
    description: 'A LangGraph workflow inspects, plans, applies, and verifies changes directly on the active diagram.',
  },
} as const;
