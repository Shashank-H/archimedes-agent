import type { AssistantIntent } from './types';

const VALID_INTENTS = new Set<AssistantIntent>(['chat', 'review', 'edit', 'review_edit', 'proactive_review']);
const EDIT_PATTERN = /\b(add|build|create|delete|draw|edit|fix|implement|improve|move|optimi[sz]e|refactor|remove|rename|reorganize|replace|style|update)\b/i;
const REVIEW_PATTERN = /\b(analy[sz]e|audit|critique|evaluate|feedback|inspect|review|risk|validate)\b/i;

export function parseAssistantIntent(content: string): AssistantIntent | null {
  const match = content.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[0]) as { intent?: unknown };
    return typeof value.intent === 'string' && VALID_INTENTS.has(value.intent as AssistantIntent)
      ? value.intent as AssistantIntent
      : null;
  } catch {
    return null;
  }
}

export function inferAssistantIntent(request: string): AssistantIntent {
  const wantsEdit = EDIT_PATTERN.test(request);
  const wantsReview = REVIEW_PATTERN.test(request);
  if (wantsEdit && wantsReview) return 'review_edit';
  if (wantsEdit) return 'edit';
  if (wantsReview) return 'review';
  return 'chat';
}
