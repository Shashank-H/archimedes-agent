import { useCallback } from 'react';
import { exportDiagramImage } from '../lib/diagramImage';
import { formatDiagramSummary } from '../lib/diagramSummary';
import { ARCHITECTURE_REVIEWER_SYSTEM_PROMPT, buildReviewPrompt } from '../lib/llm/prompts';
import type { AppSettings, ChatMessage, DiagramSnapshot, LlmChatMessage } from '../types';

export type ReviewMode = 'manual' | 'proactive' | 'chat';

const MAX_HISTORY_MESSAGES = 12;
export const DESIGN_CHANGED_CONTEXT_MESSAGE =
  'The user has changed the design after the previous review. Review the updated design again and compare against the prior feedback where relevant.';

function shouldIncludeHistory(mode: ReviewMode, settings: AppSettings) {
  if (mode === 'proactive') return settings.includeHistoryInProactiveReviews;
  return true;
}

function isConversationalMessage(message: ChatMessage) {
  return message.kind !== 'status' && message.kind !== 'error' && message.content.trim().length > 0;
}

export function chatHistoryToLlmMessages(messages: ChatMessage[], maxMessages = MAX_HISTORY_MESSAGES): LlmChatMessage[] {
  return messages
    .filter(isConversationalMessage)
    .slice(-maxMessages)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export type BuildReviewMessagesArgs = {
  settings: AppSettings;
  messages: ChatMessage[];
  snapshot: DiagramSnapshot | null;
  mode: ReviewMode;
  userPrompt?: string;
  designChangedSincePreviousReview?: boolean;
};

export async function buildReviewMessages({
  settings,
  messages,
  snapshot,
  mode,
  userPrompt,
  designChangedSincePreviousReview = false,
}: BuildReviewMessagesArgs): Promise<LlmChatMessage[]> {
  if (!snapshot) throw new Error('No diagram is available yet. Draw something first.');

  const diagram = await exportDiagramImage(snapshot);
  const metadata = formatDiagramSummary(diagram.summary);
  const prompt = buildReviewPrompt({ userPrompt, metadata, mode, thinkingLevel: settings.thinkingLevel });
  const history = shouldIncludeHistory(mode, settings) ? chatHistoryToLlmMessages(messages) : [];
  const designChangedContext: LlmChatMessage[] = designChangedSincePreviousReview
    ? [{ role: 'user', content: DESIGN_CHANGED_CONTEXT_MESSAGE }]
    : [];

  return [
    { role: 'system', content: ARCHITECTURE_REVIEWER_SYSTEM_PROMPT },
    ...history,
    ...designChangedContext,
    { role: 'user', content: prompt, images: [{ base64: diagram.base64, mimeType: diagram.mimeType }] },
  ];
}

export function useLlmReviewContext({
  settings,
  messages,
  getSnapshot,
}: {
  settings: AppSettings;
  messages: ChatMessage[];
  getSnapshot: () => DiagramSnapshot | null;
}) {
  return useCallback(
    (args: { mode: ReviewMode; userPrompt?: string; designChangedSincePreviousReview?: boolean }) =>
      buildReviewMessages({
        settings,
        messages,
        snapshot: getSnapshot(),
        mode: args.mode,
        userPrompt: args.userPrompt,
        designChangedSincePreviousReview: args.designChangedSincePreviousReview,
      }),
    [getSnapshot, messages, settings],
  );
}
