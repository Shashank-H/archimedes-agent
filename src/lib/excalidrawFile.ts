import type { BinaryFiles } from '@excalidraw/excalidraw/types';
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
    appState: parsed.appState ?? {},
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
      appState: snapshot.appState,
      files: snapshot.files,
    },
    null,
    2,
  )}\n`;
}
