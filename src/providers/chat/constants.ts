export enum ReviewMode {
  Manual = 'manual',
  Proactive = 'proactive',
  Chat = 'chat',
  Diagramming = 'diagramming',
}

export enum ChatMessageKind {
  Status = 'status',
  Error = 'error',
  ManualReview = 'manual-review',
  ProactiveReview = 'proactive-review',
  Chat = 'chat',
  Diagramming = 'diagramming',
}

export const MIN_ELEMENTS_FOR_PROACTIVE_REVIEW = 2;

export const CHAT_COPY = {
  drawFirst: 'Open an Excalidraw file, then ask me to review it.',
  selectFileFirst: 'Select and open an Excalidraw file before asking me to draw on it.',
  proactiveStatus: 'Proactively reviewing diagram...',
  manualStatus: 'Reviewing diagram image...',
  defaultReviewPrompt: 'Please review this system-design diagram.',
  modelSaveErrorStatus: 'Model has a save error',
  savedWithModelErrorStatus: 'Saved with model error',
} as const;
