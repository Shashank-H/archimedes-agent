import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';
export type AppTheme = 'light' | 'dark';

export type AppSettings = {
  ollamaEndpoint: string;
  model: string;
  temperature: number;
  thinkingLevel: ThinkingLevel;
  theme: AppTheme;
  autoReview: boolean;
  proactiveDelayMs: number;
  proactiveCooldownMs: number;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  kind?: 'chat' | 'manual-review' | 'proactive-review' | 'status' | 'error';
};

export type DiagramSnapshot = {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
  updatedAt: number;
};

export type DiagramSummary = {
  elementCount: number;
  textLabels: string[];
  arrows: Array<{
    id: string;
    text?: string;
    startBoundElementId?: string | null;
    endBoundElementId?: string | null;
  }>;
  groups: Record<string, number>;
  unlabeledElementCount: number;
  obviousUnlabeledComponents: string[];
  imageGeneratedAt: number;
};

export type DiagramExport = {
  base64: string;
  mimeType: 'image/png' | 'image/webp';
  summary: DiagramSummary;
};

export type ExcalidrawApi = ExcalidrawImperativeAPI;

export const DEFAULT_SETTINGS: AppSettings = {
  ollamaEndpoint: 'http://localhost:11434',
  model: 'gemma4:e4b',
  temperature: 0.3,
  thinkingLevel: 'low',
  theme: 'light',
  autoReview: true,
  proactiveDelayMs: 12_000,
  proactiveCooldownMs: 60_000,
};
