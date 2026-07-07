import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { llmProviderFactory, type LlmModelOption } from '../lib/llm/provider';
import type { AppSettings } from '../types';

type ModelLoadState = 'idle' | 'loading' | 'loaded' | 'error';

type UseModelSelectionArgs = {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
};

function modelMatches(option: LlmModelOption, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  return `${option.label} ${option.value}`.toLowerCase().includes(normalizedQuery);
}

export function useModelSelection({ settings, onSettingsChange }: UseModelSelectionArgs) {
  const [isOpen, setIsOpen] = useState(false);
  const [loadState, setLoadState] = useState<ModelLoadState>('idle');
  const [models, setModels] = useState<LlmModelOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const loadingRef = useRef(false);
  const hasKeyboardNavigatedRef = useRef(false);
  const lastSettingsKeyRef = useRef('');

  const credentials = settings.providerConfigurations[settings.provider]?.chatGptSubscriptionCredentials;
  const settingsKey = `${settings.provider}|${settings.endpoint}|${settings.apiKey}|${credentials?.accountId ?? ''}|${credentials?.expires ?? ''}`;

  useEffect(() => {
    if (lastSettingsKeyRef.current === settingsKey) return;
    lastSettingsKeyRef.current = settingsKey;
    requestIdRef.current += 1;
    loadingRef.current = false;
    hasKeyboardNavigatedRef.current = false;
    setModels([]);
    setError(null);
    setLoadState('idle');
    setActiveIndex(0);
    setSearchTerm('');
  }, [settingsKey]);

  const filteredModels = useMemo(() => {
    return models.filter((model) => modelMatches(model, searchTerm));
  }, [models, searchTerm]);

  useEffect(() => {
    if (!isOpen) return;

    const selectedIndex = filteredModels.findIndex((model) => model.value === settings.model);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [filteredModels, isOpen, settings.model]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const loadModels = async (force = false) => {
    if (loadingRef.current) return;
    if (!force && models.length > 0) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    loadingRef.current = true;
    setLoadState('loading');
    setError(null);

    try {
      const nextModels = await llmProviderFactory.listModels(settings);
      if (requestIdRef.current !== requestId) return;
      setModels(nextModels);
      setLoadState('loaded');
    } catch (caught) {
      if (requestIdRef.current !== requestId) return;
      setModels([]);
      setError(caught instanceof Error ? caught.message : 'Could not load models.');
      setLoadState('error');
    } finally {
      if (requestIdRef.current === requestId) {
        loadingRef.current = false;
      }
    }
  };

  const openAndLoadModels = () => {
    hasKeyboardNavigatedRef.current = false;
    setSearchTerm('');
    setIsOpen(true);
    void loadModels(true);
  };

  const updateModel = (model: string) => {
    onSettingsChange({ ...settings, model });
  };

  const selectModel = (model: LlmModelOption) => {
    updateModel(model.value);
    setIsOpen(false);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    hasKeyboardNavigatedRef.current = false;
    setSearchTerm(event.target.value);
    updateModel(event.target.value);
    setIsOpen(true);
    if (loadState === 'idle') void loadModels(false);
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      hasKeyboardNavigatedRef.current = true;
      if (!isOpen) {
        setSearchTerm('');
        setIsOpen(true);
        void loadModels(false);
        return;
      }
      if (filteredModels.length) setActiveIndex((index) => (index + 1) % filteredModels.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      hasKeyboardNavigatedRef.current = true;
      if (!isOpen) {
        setSearchTerm('');
        setIsOpen(true);
        void loadModels(false);
        return;
      }
      if (filteredModels.length) setActiveIndex((index) => (index - 1 + filteredModels.length) % filteredModels.length);
      return;
    }

    if (event.key === 'Enter' && isOpen) {
      event.preventDefault();
      const model = filteredModels[activeIndex];
      if (model && hasKeyboardNavigatedRef.current) {
        selectModel(model);
      } else {
        setIsOpen(false);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  const statusText =
    loadState === 'loading'
      ? 'Checking provider for available models…'
      : loadState === 'error'
        ? error
        : loadState === 'loaded' && models.length === 0
          ? 'No models returned by the configured provider.'
          : filteredModels.length === 0 && models.length > 0
            ? 'No models match your search.'
            : null;

  return {
    rootRef,
    isOpen,
    loadState,
    models,
    filteredModels,
    activeIndex,
    statusText,
    openAndLoadModels,
    onInputChange,
    onInputKeyDown,
    selectModel,
  };
}
