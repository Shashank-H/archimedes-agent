import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { DiagramSnapshot } from '../../types';
import type { DiagramOperation, DiagramPlan } from './types';

const EDITABLE_ELEMENT_KEYS = new Set(['x', 'y', 'width', 'height', 'angle', 'text', 'strokeColor', 'backgroundColor', 'fillStyle', 'strokeWidth', 'strokeStyle', 'roughness', 'opacity', 'groupIds', 'isDeleted']);
const PERSISTENT_APP_STATE_KEYS = new Set(['viewBackgroundColor', 'gridSize', 'theme']);

function requireElementIds(elements: readonly ExcalidrawElement[], elementIds: string[]) {
  const knownIds = new Set(elements.map((element) => element.id));
  const unknownIds = elementIds.filter((id) => !knownIds.has(id));
  if (unknownIds.length) throw new Error(`The diagram does not contain element ${unknownIds.map((id) => `\`${id}\``).join(', ')}.`);
}

function patchElement(element: ExcalidrawElement, patch: Record<string, unknown>) {
  const unsafeKeys = Object.keys(patch).filter((key) => !EDITABLE_ELEMENT_KEYS.has(key));
  if (unsafeKeys.length) throw new Error(`The plan attempted to change unsupported properties: ${unsafeKeys.join(', ')}.`);
  return { ...element, ...patch, version: element.version + 1, updated: Date.now() } as ExcalidrawElement;
}

function moveElements(elements: readonly ExcalidrawElement[], elementIds: string[], update: (element: ExcalidrawElement) => Partial<ExcalidrawElement>) {
  requireElementIds(elements, elementIds);
  const ids = new Set(elementIds);
  return elements.map((element) => (ids.has(element.id) ? patchElement(element, update(element)) : element));
}

function alignElements(elements: readonly ExcalidrawElement[], operation: Extract<DiagramOperation, { type: 'align' }>) {
  requireElementIds(elements, operation.elementIds);
  const selected = elements.filter((element) => operation.elementIds.includes(element.id));
  if (selected.length < 2) return [...elements];

  const left = Math.min(...selected.map((element) => element.x));
  const right = Math.max(...selected.map((element) => element.x + element.width));
  const top = Math.min(...selected.map((element) => element.y));
  const bottom = Math.max(...selected.map((element) => element.y + element.height));
  const ids = new Set(operation.elementIds);

  return elements.map((element) => {
    if (!ids.has(element.id)) return element;
    switch (operation.axis) {
      case 'left': return patchElement(element, { x: left });
      case 'center': return patchElement(element, { x: left + (right - left - element.width) / 2 });
      case 'right': return patchElement(element, { x: right - element.width });
      case 'top': return patchElement(element, { y: top });
      case 'middle': return patchElement(element, { y: top + (bottom - top - element.height) / 2 });
      case 'bottom': return patchElement(element, { y: bottom - element.height });
    }
  });
}

function applyOperation(snapshot: DiagramSnapshot, operation: DiagramOperation): DiagramSnapshot {
  const elements = [...snapshot.elements];
  switch (operation.type) {
    case 'create': {
      const created = convertToExcalidrawElements(operation.elements as ExcalidrawElementSkeleton[], { regenerateIds: true });
      return { ...snapshot, elements: [...elements, ...created], updatedAt: Date.now() };
    }
    case 'update':
      return { ...snapshot, elements: moveElements(elements, [operation.elementId], () => operation.patch), updatedAt: Date.now() };
    case 'delete': {
      requireElementIds(elements, operation.elementIds);
      const ids = new Set(operation.elementIds);
      return { ...snapshot, elements: elements.map((element) => (ids.has(element.id) ? patchElement(element, { isDeleted: true }) : element)), updatedAt: Date.now() };
    }
    case 'style':
      return { ...snapshot, elements: moveElements(elements, operation.elementIds, () => operation.patch), updatedAt: Date.now() };
    case 'group': {
      requireElementIds(elements, operation.elementIds);
      const ids = new Set(operation.elementIds);
      const groupId = operation.groupId?.trim() || crypto.randomUUID();
      return { ...snapshot, elements: elements.map((element) => (ids.has(element.id) ? patchElement(element, { groupIds: [...element.groupIds, groupId] }) : element)), updatedAt: Date.now() };
    }
    case 'order': {
      requireElementIds(elements, operation.elementIds);
      const ids = new Set(operation.elementIds);
      const selected = elements.filter((element) => ids.has(element.id));
      const rest = elements.filter((element) => !ids.has(element.id));
      return { ...snapshot, elements: operation.position === 'front' ? [...rest, ...selected] : [...selected, ...rest], updatedAt: Date.now() };
    }
    case 'align':
      return { ...snapshot, elements: alignElements(elements, operation), updatedAt: Date.now() };
    case 'appState': {
      const invalidKeys = Object.keys(operation.patch).filter((key) => !PERSISTENT_APP_STATE_KEYS.has(key));
      if (invalidKeys.length) throw new Error(`The plan attempted to change unsupported app state: ${invalidKeys.join(', ')}.`);
      return { ...snapshot, appState: { ...snapshot.appState, ...operation.patch }, updatedAt: Date.now() };
    }
  }
}

/** Framework-neutral local executor for generic Excalidraw edit plans. */
export class DiagramToolRuntime {
  applyPlan(snapshot: DiagramSnapshot, plan: DiagramPlan): DiagramSnapshot {
    return plan.operations.reduce(applyOperation, snapshot);
  }
}

export const diagramToolRuntime = new DiagramToolRuntime();
