export enum ChatMessageKind {
  Status = 'status',
  Error = 'error',
  ProactiveReview = 'proactive-review',
  Chat = 'chat',
}

export const MIN_ELEMENTS_FOR_PROACTIVE_REVIEW = 2;

export const CHAT_COPY = {
  selectFileFirst: 'Open an Excalidraw file before asking Archimedes to change the diagram.',
  modelSaveErrorStatus: 'Model settings need attention',
  savedWithModelErrorStatus: 'Saved · model test failed',
} as const;
