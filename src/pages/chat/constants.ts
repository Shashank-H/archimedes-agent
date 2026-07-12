export const THINKING_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const CHAT_SECTION_TABS = [
  { id: 'review', label: 'Review' },
  { id: 'diagramming', label: 'Diagramming' },
] as const;

export type ChatSectionTab = (typeof CHAT_SECTION_TABS)[number]['id'];

export const CHAT_EMPTY_STATES = {
  review: {
    kicker: 'No review yet',
    title: 'Draw a system design, then ask Archimedes for a review.',
    description: 'Switch to proactive mode for automatic diagram reviews, or keep manual mode and trigger review from the composer.',
  },
  diagramming: {
    kicker: 'Diagramming ready',
    title: 'Open an Excalidraw file, then describe what to draw.',
    description: 'Archimedes inspects the opened diagram and applies the requested change directly to that tab.',
  },
} as const;
