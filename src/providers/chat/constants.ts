export enum ReviewMode {
  Manual = 'manual',
  Proactive = 'proactive',
  Chat = 'chat',
}

export enum ChatMessageKind {
  Status = 'status',
  Error = 'error',
  ManualReview = 'manual-review',
  ProactiveReview = 'proactive-review',
  Chat = 'chat',
}

export const MIN_ELEMENTS_FOR_PROACTIVE_REVIEW = 2;

export const CHAT_COPY = {
  drawFirst: 'Draw a diagram first, then ask me to review it.',
  proactiveStatus: 'Proactively reviewing diagram...',
  manualStatus: 'Reviewing diagram image...',
  defaultReviewPrompt: 'Please review this system-design diagram.',
  modelSaveErrorStatus: 'Model has a save error',
  savedWithModelErrorStatus: 'Saved with model error',
} as const;
