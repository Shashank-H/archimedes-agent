import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from './http/installTauriFetch';

export async function openExternalUrl(url: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('open_external_url', { url });
    return;
  }

  const openedWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!openedWindow) {
    window.location.assign(url);
  }
}
