import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { ExcalidrawElementSkeleton } from '@excalidraw/excalidraw/data/transform';
import type { DiagramSnapshot } from '../../types';
import type { DiagramOperation, DiagramPlan } from './types';

const UPDATE_KEYS = new Set(['x', 'y', 'width', 'height', 'angle', 'text', 'strokeColor', 'backgroundColor', 'fillStyle', 'strokeWidth', 'strokeStyle', 'roughness', 'opacity']);
const STYLE_KEYS = new Set(['strokeColor', 'backgroundColor', 'fillStyle', 'strokeWidth', 'strokeStyle', 'roughness', 'opacity']);
const INTERNAL_KEYS = new Set([...UPDATE_KEYS, 'groupIds', 'isDeleted']);
const PERSISTENT_APP_STATE_KEYS = new Set(['viewBackgroundColor', 'gridSize', 'theme']);
const CREATE_TYPES = new Set(['rectangle', 'ellipse', 'diamond', 'line', 'arrow', 'text', 'freedraw', 'image', 'frame']);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validatePatch(patch: Record<string, unknown>, allowed: Set<string>) {
  const invalidKeys = Object.keys(patch).filter((key) => !allowed.has(key));
  if (invalidKeys.length) throw new Error(`The plan attempted to change unsupported properties: ${invalidKeys.join(', ')}.`);
  for (const [key, value] of Object.entries(patch)) {
    if (['x', 'y', 'width', 'height', 'angle', 'strokeWidth', 'roughness', 'opacity'].includes(key) && !isFiniteNumber(value)) {
      throw new Error(`The diagram property ${key} must be a finite number.`);
    }
    if ((key === 'width' || key === 'height') && (value as number) <= 0) throw new Error(`${key} must be greater than zero.`);
    if (key === 'opacity' && ((value as number) < 0 || (value as number) > 100)) throw new Error('opacity must be between 0 and 100.');
    if (key === 'text' && typeof value !== 'string') throw new Error('text must be a string.');
    if ((key === 'strokeColor' || key === 'backgroundColor') && (typeof value !== 'string' || value.length > 64)) throw new Error(`${key} must be a valid color string.`);
  }
}

function validatePlan(plan: DiagramPlan) {
  for (const operation of plan.operations) {
    if (operation.type === 'update') validatePatch(operation.patch, UPDATE_KEYS);
    if (operation.type === 'style') validatePatch(operation.patch, STYLE_KEYS);
    if (operation.type === 'create') {
      for (const element of operation.elements) {
        if (!element || typeof element !== 'object' || !CREATE_TYPES.has(String((element as { type?: unknown }).type))) throw new Error('Create operations contain an unsupported element type.');
        const candidate = element as Record<string, unknown>;
        for (const key of ['x', 'y', 'width', 'height']) {
          if (candidate[key] !== undefined && !isFiniteNumber(candidate[key])) throw new Error(`Created element ${key} must be a finite number.`);
        }
        if (isFiniteNumber(candidate.width) && candidate.width <= 0) throw new Error('Created element width must be greater than zero.');
        if (isFiniteNumber(candidate.height) && candidate.height <= 0) throw new Error('Created element height must be greater than zero.');
      }
    }
    if (operation.type === 'appState') {
      const invalidKeys = Object.keys(operation.patch).filter((key) => !PERSISTENT_APP_STATE_KEYS.has(key));
      if (invalidKeys.length) throw new Error(`The plan attempted to change unsupported app state: ${invalidKeys.join(', ')}.`);
      if (operation.patch.gridSize !== undefined && (!isFiniteNumber(operation.patch.gridSize) || operation.patch.gridSize < 1 || operation.patch.gridSize > 200)) throw new Error('gridSize must be between 1 and 200.');
      if (operation.patch.theme !== undefined && !['light', 'dark'].includes(String(operation.patch.theme))) throw new Error('theme must be light or dark.');
      if (operation.patch.viewBackgroundColor !== undefined && typeof operation.patch.viewBackgroundColor !== 'string') throw new Error('viewBackgroundColor must be a string.');
    }
  }
}

function requireElementIds(elements: readonly ExcalidrawElement[], elementIds: string[]) {
  const knownIds = new Set(elements.map((element) => element.id));
  const unknownIds = elementIds.filter((id) => !knownIds.has(id));
  if (unknownIds.length) throw new Error(`The diagram does not contain element ${unknownIds.map((id) => `\`${id}\``).join(', ')}.`);
}

function patchElement(element: ExcalidrawElement, patch: Record<string, unknown>) {
  const unsafeKeys = Object.keys(patch).filter((key) => !INTERNAL_KEYS.has(key));
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
    validatePlan(plan);
    return plan.operations.reduce(applyOperation, snapshot);
  }
}

export const diagramToolRuntime = new DiagramToolRuntime();
