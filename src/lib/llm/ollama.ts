import type { AppSettings } from '../../types';
import { BaseLlmProvider, type StreamLlmChatArgs } from './base';

function normalizeEndpoint(endpoint: string) {
  return endpoint.replace(/\/+$/, '');
}

async function parseOllamaError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.error || `${response.status} ${response.statusText}`;
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

export type OllamaModelInfo = {
  name?: string;
  model?: string;
  capabilities?: string[];
};

type OllamaThinkingConfig = {
  think: false | 'low' | 'medium' | 'high';
};

export class OllamaProvider extends BaseLlmProvider {
  readonly id = 'ollama' as const;
  readonly name = 'Ollama';
  readonly metadata = {
    id: this.id,
    label: this.name,
    defaultEndpoint: 'http://localhost:11434',
    defaultModel: 'gemma4:e4b',
    requiresApiKey: false,
  } as const;

  private getThinkingConfig(settings: AppSettings): OllamaThinkingConfig {
    if (settings.thinkingLevel === 'off') return { think: false };
    return { think: settings.thinkingLevel };
  }

  async streamChat({ settings, messages, signal, onToken }: StreamLlmChatArgs) {
    const endpoint = normalizeEndpoint(settings.endpoint);
    const ollamaMessages = messages.map((message) => ({
      role: message.role,
      content: message.content,
      images: message.images?.map((image) => image.base64),
    }));

    const response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: settings.model,
        stream: true,
        ...this.getThinkingConfig(settings),
        options: { temperature: settings.temperature },
        messages: ollamaMessages,
      }),
    });

    if (!response.ok) {
      const error = await parseOllamaError(response);
      throw new Error(`Ollama request failed: ${error}`);
    }
    if (!response.body) {
      throw new Error('Ollama response did not include a stream.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const json = JSON.parse(trimmed) as { done?: boolean; message?: { content?: string }; response?: string; error?: string };
        if (json.error) throw new Error(json.error);
        const token = json.message?.content ?? json.response ?? '';
        if (token) onToken(token);
        if (json.done) return;
      }
    }
  }

  async testConnection(settings: AppSettings) {
    const endpoint = normalizeEndpoint(settings.endpoint);
    const response = await fetch(`${endpoint}/api/tags`);
    if (!response.ok) throw new Error(await parseOllamaError(response));
    const data = (await response.json()) as { models?: OllamaModelInfo[] };
    const models = data.models ?? [];
    const selectedModel = models.find((model) => model.name === settings.model || model.model === settings.model);

    return {
      provider: this.id,
      providerName: this.name,
      supportsVision: Boolean(selectedModel?.capabilities?.includes('vision')),
      visionSupportKnown: true,
      selectedModel,
    };
  }
}
