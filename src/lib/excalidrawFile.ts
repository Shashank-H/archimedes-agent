import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { DiagramSnapshot } from '../types';

export class ExcalidrawFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExcalidrawFileError';
  }
}

type ExcalidrawFilePayload = {
  type?: string;
  version?: number;
  source?: string;
  elements?: readonly ExcalidrawElement[];
  appState?: Record<string, unknown>;
  files?: BinaryFiles;
};

const PERSISTENT_APP_STATE_KEYS = [
  'viewBackgroundColor',
  'currentItemStrokeColor',
  'currentItemBackgroundColor',
  'currentItemFillStyle',
  'currentItemStrokeWidth',
  'currentItemStrokeStyle',
  'currentItemRoughness',
  'currentItemOpacity',
  'gridSize',
  'theme',
] as const;

export function createPersistentAppState(appState: Partial<AppState> | Record<string, unknown> = {}): Partial<AppState> {
  const appStateRecord = appState as Record<string, unknown>;

  return PERSISTENT_APP_STATE_KEYS.reduce((persistentAppState, key) => {
    if (key in appStateRecord) {
      return {
        ...persistentAppState,
        [key]: appStateRecord[key],
      };
    }

    return persistentAppState;
  }, {} as Partial<AppState>);
}

export function parseExcalidrawFile(content: string): DiagramSnapshot {
  let parsed: ExcalidrawFilePayload;

  try {
    parsed = JSON.parse(content) as ExcalidrawFilePayload;
  } catch {
    throw new ExcalidrawFileError('This file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new ExcalidrawFileError('This file does not contain an Excalidraw document.');
  }

  if (!Array.isArray(parsed.elements)) {
    throw new ExcalidrawFileError('This file is missing the Excalidraw elements array.');
  }

  return {
    elements: parsed.elements,
    appState: createPersistentAppState(parsed.appState),
    files: parsed.files ?? {},
    updatedAt: Date.now(),
  };
}

export function serializeExcalidrawFile(snapshot: DiagramSnapshot) {
  return `${JSON.stringify(
    {
      type: 'excalidraw',
      version: 2,
      source: 'archimedes-agent',
      elements: snapshot.elements,
      appState: createPersistentAppState(snapshot.appState),
      files: snapshot.files,
    },
    null,
    2,
  )}\n`;
}
