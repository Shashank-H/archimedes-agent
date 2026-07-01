import { useMemo, useRef, useState } from 'react';
import { getOllamaOriginInstructions, type LocalOllamaOs } from '../constants';
import { detectBrowserOs } from '../utils';

export function useOllamaOriginInstructions(siteOrigin: string) {
  const detectedOsRef = useRef<LocalOllamaOs | null>(null);
  if (detectedOsRef.current === null) detectedOsRef.current = detectBrowserOs();

  const [selectedOs, setSelectedOs] = useState<LocalOllamaOs>(detectedOsRef.current);
  const instructions = useMemo(() => getOllamaOriginInstructions(siteOrigin), [siteOrigin]);

  return {
    detectedOs: detectedOsRef.current,
    selectedInstruction: instructions[selectedOs],
    selectedOs,
    setSelectedOs,
  };
}
