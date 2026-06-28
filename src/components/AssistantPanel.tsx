import { useEffect, useId, useRef, useState } from 'react';
import { MarkdownMessage } from './MarkdownMessage';
import { AppTooltip } from './AppTooltip';
import { CustomSelect } from './CustomSelect';
import { TooltipIconAction } from './TooltipIconAction';
import { useProviderSettings } from '../hooks/useProviderSettings';
import { useModelSelection } from '../hooks/useModelSelection';
import { useMaskedApiKeyInput } from '../hooks/useMaskedApiKeyInput';
import { useReviewTimingSettings } from '../hooks/useReviewTimingSettings';
import { settingsValidationKey } from '../lib/settingsValidation';
import type { AppSettings, ChatMessage, LlmProvider, ThinkingLevel } from '../types';

type AssistantPanelProps = {
  messages: ChatMessage[];
  settings: AppSettings;
  isBusy: boolean;
  status: string;
  modelValidationError?: string | null;
  onSendChat: (prompt: string) => void;
  onReview: (prompt?: string) => void;
  onSettingsChange: (settings: AppSettings) => void;
  onClearChat: () => void;
  onTestConnection: () => boolean | Promise<boolean>;
};

type IconName =
  | 'brain'
  | 'settings'
  | 'message'
  | 'plug'
  | 'moon'
  | 'sun'
  | 'zap'
  | 'sparkles'
  | 'play'
  | 'pause'
  | 'send'
  | 'trash'
  | 'user'
  | 'sliders'
  | 'info'
  | 'x'
  | 'github'
  | 'eye'
  | 'copy'
  | 'check'
  | 'chevronDown';

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'brain':
      return <svg {...common}><path d="M9.5 2A3.5 3.5 0 0 0 6 5.5v.3A3.7 3.7 0 0 0 3 9.5c0 1 .4 2 1.1 2.7A4.4 4.4 0 0 0 3 15.2 4.8 4.8 0 0 0 7.8 20H10V2h-.5Z"/><path d="M14.5 2A3.5 3.5 0 0 1 18 5.5v.3a3.7 3.7 0 0 1 3 3.7c0 1-.4 2-1.1 2.7a4.4 4.4 0 0 1 1.1 3A4.8 4.8 0 0 1 16.2 20H14V2h.5Z"/><path d="M7.5 9.5H10M14 9.5h2.5M8 14h2M14 14h2"/></svg>;
    case 'settings':
      return <svg {...common}><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>;
    case 'message':
      return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/></svg>;
    case 'plug':
      return <svg {...common}><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8h12Z"/></svg>;
    case 'moon':
      return <svg {...common}><path d="M20.9 13.5A8.5 8.5 0 1 1 10.5 3.1 6.7 6.7 0 0 0 20.9 13.5Z"/></svg>;
    case 'sun':
      return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>;
    case 'zap':
      return <svg {...common}><path d="M13 2 3 14h8l-1 8 11-14h-8l1-6Z"/></svg>;
    case 'sparkles':
      return <svg {...common}><path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Z"/></svg>;
    case 'play':
      return <svg {...common}><path d="m8 5 11 7-11 7V5Z"/></svg>;
    case 'pause':
      return <svg {...common}><path d="M10 4H6v16h4V4Z"/><path d="M18 4h-4v16h4V4Z"/></svg>;
    case 'send':
      return <svg {...common}><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg>;
    case 'trash':
      return <svg {...common}><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>;
    case 'user':
      return <svg {...common}><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'sliders':
      return <svg {...common}><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M2 14h4"/><path d="M10 8h4"/><path d="M18 16h4"/></svg>;
    case 'info':
      return <svg {...common}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>;
    case 'x':
      return <svg {...common}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
    case 'github':
      return <svg {...common}><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.3-.3-2.6-1.2-3.6.2-1.2.2-2.5-.1-3.6 0 0-1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 1.5 5.5 1.8 5.5 1.8c-.3 1.1-.4 2.4-.1 3.6A5.3 5.3 0 0 0 4.2 9c0 3.5 3 5.5 6 5.5-.5.5-.8 1.2-.9 2"/><path d="M9 18c-4.5 2-5-2-7-2"/></svg>;
    case 'eye':
      return <svg {...common}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'copy':
      return <svg {...common}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>;
    case 'check':
      return <svg {...common}><path d="M20 6 9 17l-5-5"/></svg>;
    case 'chevronDown':
      return <svg {...common}><path d="m6 9 6 6 6-6"/></svg>;
  }
}

const PROJECT_GITHUB_URL = 'https://github.com/Shashank-H/archimedes-agent';
const X_PROFILE_URL = 'https://x.com/ShashankH_';
const OLLAMA_VISION_MODELS_URL = 'https://ollama.com/search?c=vision';
const THINKING_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const RECOMMENDED_VISION_MODELS = [
  {
    name: 'Gemma 4 E2B',
    tag: 'gemma4:e2b',
    bestFor: 'System requirements: under 8GB RAM. Choose this for lightweight local diagram review on modest machines.',
    command: 'ollama pull gemma4:e2b',
    url: 'https://ollama.com/library/gemma4:e2b',
  },
  {
    name: 'Gemma 4 E4B',
    tag: 'gemma4:e4b',
    bestFor: 'System requirements: 16GB RAM recommended. Choose this for higher-quality Archimedes diagram review.',
    command: 'ollama pull gemma4:e4b',
    url: 'https://ollama.com/library/gemma4:e4b',
  },
];

const OPEN_SOURCE_CREDITS = [
  { name: 'Design.md Vercel analysis', packageName: 'getdesign.md/vercel/design-md', license: 'Independent public design analysis', url: 'https://getdesign.md/vercel/design-md', note: 'Vercel-inspired DESIGN.md reference used for visual direction; not affiliated with Vercel.' },
  { name: 'Excalidraw', packageName: '@excalidraw/excalidraw', license: 'MIT', url: 'https://github.com/excalidraw/excalidraw', note: 'Embeddable whiteboard and diagram canvas.' },
  { name: 'Tauri', packageName: '@tauri-apps/api / @tauri-apps/cli', license: 'Apache-2.0 OR MIT', url: 'https://tauri.app', note: 'Desktop app runtime, APIs, and build tooling.' },
  { name: 'PostHog JS', packageName: 'posthog-js', license: 'See package LICENSE', url: 'https://posthog.com/docs/libraries/js', note: 'Privacy-aware product analytics client.' },
  { name: 'Radix UI Tooltip', packageName: '@radix-ui/react-tooltip', license: 'MIT', url: 'https://www.radix-ui.com/primitives/docs/components/tooltip', note: 'Accessible Radix UI tooltip primitive used for consistent in-app tooltip behavior.' },
  { name: 'React', packageName: 'react / react-dom', license: 'MIT', url: 'https://react.dev', note: 'User-interface rendering framework.' },
  { name: 'Vite', packageName: 'vite / @vitejs/plugin-react', license: 'MIT', url: 'https://vite.dev', note: 'Development server and production bundler.' },
  { name: 'TypeScript', packageName: 'typescript', license: 'Apache-2.0', url: 'https://www.typescriptlang.org', note: 'Typed JavaScript language tooling.' },
  { name: 'DefinitelyTyped', packageName: '@types/node / @types/react / @types/react-dom', license: 'MIT', url: 'https://github.com/DefinitelyTyped/DefinitelyTyped', note: 'Community TypeScript type definitions.' },
];

type LocalOllamaOs = 'windows' | 'mac' | 'linux';

const OLLAMA_OS_OPTIONS: Array<{ value: LocalOllamaOs; label: string }> = [
  { value: 'windows', label: 'Windows' },
  { value: 'mac', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
];

function detectBrowserOs(): LocalOllamaOs {
  if (typeof navigator === 'undefined') return 'mac';

  const navigatorWithUserAgentData = navigator as Navigator & { userAgentData?: { platform?: string } };
  const osHint = `${navigatorWithUserAgentData.userAgentData?.platform ?? ''} ${navigator.platform} ${navigator.userAgent}`.toLowerCase();

  if (osHint.includes('win')) return 'windows';
  if (osHint.includes('mac') || osHint.includes('iphone') || osHint.includes('ipad')) return 'mac';
  if (osHint.includes('linux') || osHint.includes('x11') || osHint.includes('android') || osHint.includes('cros')) return 'linux';

  return 'mac';
}

function useOllamaOriginInstructions(siteOrigin: string) {
  const detectedOsRef = useRef<LocalOllamaOs | null>(null);
  if (detectedOsRef.current === null) detectedOsRef.current = detectBrowserOs();

  const [selectedOs, setSelectedOs] = useState<LocalOllamaOs>(detectedOsRef.current);
  const instructions: Record<LocalOllamaOs, { backgroundCommand: string; permanentCommand: string; permanentNote: string; description: string; quitSteps: string[]; quitCommand?: string }> = {
    windows: {
      backgroundCommand: `Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile -Command "$env:OLLAMA_ORIGINS=\"${siteOrigin}\"; ollama serve"'`,
      permanentCommand: `setx OLLAMA_ORIGINS "${siteOrigin}"`,
      permanentNote: 'Recommended. After running setx, quit and reopen Ollama. Windows applies setx values only to new processes.',
      description: 'Use these steps to permanently allow this site, then reopen Ollama normally.',
      quitSteps: [
        'Click the Ollama llama icon in the Windows system tray and choose Quit, if it is visible.',
        'If it is not visible, open Task Manager and end any Ollama or ollama.exe process.',
        'PowerShell alternative:',
      ],
      quitCommand: 'taskkill /IM ollama.exe /F',
    },
    mac: {
      backgroundCommand: `mkdir -p ~/.ollama && nohup env OLLAMA_ORIGINS="${siteOrigin}" ollama serve > ~/.ollama/ollama.log 2>&1 &`,
      permanentCommand: `launchctl setenv OLLAMA_ORIGINS "${siteOrigin}"`,
      permanentNote: 'Recommended for the Ollama desktop app. After running launchctl, quit and reopen the Ollama app. You may need to run it again after a reboot.',
      description: 'Use these steps to allow this site for the Ollama app, then reopen Ollama normally.',
      quitSteps: [
        'Click the Ollama llama icon in the macOS menu bar and choose Quit Ollama.',
        'If the menu bar icon is not available, run the terminal command below to stop the background process.',
      ],
      quitCommand: 'pkill ollama',
    },
    linux: {
      backgroundCommand: `mkdir -p ~/.ollama && nohup env OLLAMA_ORIGINS="${siteOrigin}" ollama serve > ~/.ollama/ollama.log 2>&1 &`,
      permanentCommand: `sudo mkdir -p /etc/systemd/system/ollama.service.d && printf '[Service]\nEnvironment="OLLAMA_ORIGINS=${siteOrigin}"\n' | sudo tee /etc/systemd/system/ollama.service.d/override.conf && sudo systemctl daemon-reload && sudo systemctl restart ollama`,
      permanentNote: 'Recommended when Ollama is installed as a systemd service. It writes a service override and restarts Ollama automatically.',
      description: 'Use these steps to permanently allow this site for the Ollama service.',
      quitSteps: [
        'If Ollama is running as a systemd service, stop it first.',
        'If you started Ollama manually, stop the process instead.',
      ],
      quitCommand: 'sudo systemctl stop ollama || pkill ollama',
    },
  };

  return {
    detectedOs: detectedOsRef.current,
    selectedInstruction: instructions[selectedOs],
    selectedOs,
    setSelectedOs,
  };
}

export function AssistantPanel({
  messages,
  settings,
  isBusy,
  status,
  modelValidationError,
  onSendChat,
  onReview,
  onSettingsChange,
  onClearChat,
  onTestConnection,
}: AssistantPanelProps) {
  const providerConfigurationKey = settingsValidationKey(settings);
  const providerConfigurationIsTested = settings.providerConfigurationTestedKey === providerConfigurationKey;
  const [prompt, setPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [providerConfigOpen, setProviderConfigOpen] = useState(!providerConfigurationIsTested);
  const [reviewTimingOpen, setReviewTimingOpen] = useState(false);
  const [showOllamaSetup, setShowOllamaSetup] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelListboxId = useId();
  const copyResetTimeoutRef = useRef<number | null>(null);
  const {
    providerOptions,
    providerMetadata,
    endpointPlaceholder,
    modelPlaceholder,
    testConnectionLabel,
    modelInfoTooltip,
    updateProvider,
  } = useProviderSettings(settings, onSettingsChange);
  const modelSelection = useModelSelection({ settings, onSettingsChange });
  const maskedApiKeyInput = useMaskedApiKeyInput({ settings, onSettingsChange });
  const reviewTiming = useReviewTimingSettings({ settings, onSettingsChange });
  const currentSiteOrigin = typeof window === 'undefined' ? 'https://this-site.example' : window.location.origin;
  const ollamaOriginInstructions = useOllamaOriginInstructions(currentSiteOrigin);

  const resizePromptInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 168)}px`;
  };

  useEffect(() => {
    resizePromptInput();
  }, [prompt]);

  useEffect(() => {
    setProviderConfigOpen(!providerConfigurationIsTested);
  }, [providerConfigurationIsTested, providerConfigurationKey]);

  useEffect(() => {
    if (!showCredits && !showOllamaSetup) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowCredits(false);
      setShowOllamaSetup(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCredits, showOllamaSetup]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const submit = () => {
    const value = prompt.trim();
    if (!value || isBusy) return;
    onSendChat(value);
    setPrompt('');
  };

  const copyCommand = (command: string) => {
    void navigator.clipboard?.writeText(command);
    setCopiedCommand(command);

    if (copyResetTimeoutRef.current) {
      window.clearTimeout(copyResetTimeoutRef.current);
    }

    copyResetTimeoutRef.current = window.setTimeout(() => {
      setCopiedCommand(null);
      copyResetTimeoutRef.current = null;
    }, 900);
  };

  const renderCopyableCommand = (command: string) => (
    <div className="vision-model-command copyable-command">
      <code>{command}</code>
      <AppTooltip label={copiedCommand === command ? 'Copied' : `Copy ${command}`}>
        <button
          type="button"
          className={`model-copy-button${copiedCommand === command ? ' is-copied' : ''}`}
          onClick={() => copyCommand(command)}
          aria-label={copiedCommand === command ? `Copied ${command}` : `Copy ${command}`}
        >
          <Icon name={copiedCommand === command ? 'check' : 'copy'} size={14} />
        </button>
      </AppTooltip>
    </div>
  );
  
  const updateEndpoint = (endpoint: string) => {
    onSettingsChange({ ...settings, endpoint });
  };

  const handleSaveProviderConfiguration = async () => {
    const isValid = await onTestConnection();
    if (isValid) setProviderConfigOpen(false);
  };

  return (
    <aside className="assistant-panel">
      <header className="assistant-header">
        <div className="assistant-title">
          <span className="assistant-mark">
            <img className="logo-light" src="/logos/logo-light.svg" alt="" aria-hidden="true" />
            <img className="logo-dark" src="/logos/logo-dark.svg" alt="" aria-hidden="true" />
          </span>
          <div className="assistant-title-copy">
            <div className="assistant-heading-row">
              <h1>Archimedes Agent</h1>
              <div className="assistant-header-actions">
                <AppTooltip label={showSettings ? 'Back to chat' : 'Settings'}>
                  <button
                    className="settings-toggle"
                    onClick={() => setShowSettings((value) => !value)}
                    aria-label={showSettings ? 'Back to chat' : 'Open settings'}
                  >
                    <Icon name={showSettings ? 'message' : 'settings'} size={15} />
                    <span>{showSettings ? 'Chat' : 'Settings'}</span>
                  </button>
                </AppTooltip>
              </div>
            </div>
            <p>{status}</p>
          </div>
        </div>
      </header>

      {showSettings ? (
        <section className="settings-section">
          <div className="provider-config-accordion" data-open={providerConfigOpen ? 'true' : 'false'}>
            <button
              type="button"
              className="provider-config-summary"
              onClick={() => setProviderConfigOpen((value) => !value)}
              aria-expanded={providerConfigOpen}
            >
              <span>
                <strong>Provider configuration</strong>
                <small>{providerMetadata.label} · {settings.model}</small>
              </span>
              <Icon name="chevronDown" size={15} />
            </button>
            {providerConfigOpen && (
              <div className="provider-config-content">
                <label>
                  Provider
                  <CustomSelect
                    ariaLabel="Provider"
                    value={settings.provider}
                    options={providerOptions.map((provider) => ({ value: provider.id, label: provider.label }))}
                    onChange={(value) => updateProvider(value as LlmProvider)}
                    className="settings-provider-select"
                  />
                </label>
                <label>
                  Endpoint / base URL
                  <input
                    value={settings.endpoint}
                    placeholder={endpointPlaceholder}
                    onChange={(event) => updateEndpoint(event.target.value)}
                  />
                </label>
                {providerMetadata.requiresApiKey && (
                  <label>
                    API key
                    <input
                      type="text"
                      value={maskedApiKeyInput.displayValue}
                      placeholder="Bearer token for this provider"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      data-lpignore="true"
                      data-1p-ignore="true"
                      onKeyDown={maskedApiKeyInput.onKeyDown}
                      onPaste={maskedApiKeyInput.onPaste}
                      onChange={maskedApiKeyInput.onChange}
                    />
                  </label>
                )}
                <label>
                  <span className="settings-inline-label">
                    <span>Model</span>
                    <AppTooltip label={modelInfoTooltip}>
                      <button type="button" className="settings-help-icon" aria-label="Model endpoint information">
                        <Icon name="info" size={13} />
                      </button>
                    </AppTooltip>
                  </span>
                  <div
                    ref={modelSelection.rootRef}
                    className="model-combobox"
                    data-open={modelSelection.isOpen ? 'true' : 'false'}
                    data-error={modelValidationError ? 'true' : 'false'}
                  >
                    <input
                      value={settings.model}
                      placeholder={modelPlaceholder}
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={modelSelection.isOpen}
                      aria-controls={modelListboxId}
                      onFocus={modelSelection.openAndLoadModels}
                      onClick={modelSelection.openAndLoadModels}
                      onChange={modelSelection.onInputChange}
                      onKeyDown={modelSelection.onInputKeyDown}
                    />
                    <span className="model-combobox-caret" aria-hidden="true">
                      <Icon name="chevronDown" size={14} />
                    </span>
                    {modelSelection.isOpen && (
                      <div id={modelListboxId} className="model-combobox-menu" role="listbox" aria-label="Available models">
                        {modelSelection.filteredModels.map((model, index) => (
                          <button
                            type="button"
                            key={model.value}
                            className="model-combobox-option"
                            role="option"
                            aria-selected={model.value === settings.model}
                            data-active={index === modelSelection.activeIndex ? 'true' : 'false'}
                            data-selected={model.value === settings.model ? 'true' : 'false'}
                            onClick={() => modelSelection.selectModel(model)}
                          >
                            <span>{model.label}</span>
                            {model.supportsVision && <span className="model-vision-pill">Vision</span>}
                          </button>
                        ))}
                        {modelSelection.statusText && (
                          <p className="model-combobox-status" role={modelSelection.loadState === 'error' ? 'alert' : 'status'}>
                            {modelSelection.statusText}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {modelValidationError && <p className="settings-field-error">{modelValidationError}</p>}
                </label>
                {settings.provider === 'ollama' && (
                  <button type="button" className="secondary-settings-button" onClick={() => setShowOllamaSetup(true)}>
                    <Icon name="info" size={15} />
                    Setup local vision model
                  </button>
                )}
                <label>
                  Temperature: {settings.temperature.toFixed(1)}
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.temperature}
                    onChange={(event) => onSettingsChange({ ...settings, temperature: Number(event.target.value) })}
                  />
                </label>
                <div className="provider-config-actions">
                  <button onClick={handleSaveProviderConfiguration} disabled={isBusy}>
                    <Icon name="plug" size={15} />
                    {testConnectionLabel}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="provider-config-accordion" data-open={reviewTimingOpen ? 'true' : 'false'}>
            <button
              type="button"
              className="provider-config-summary"
              onClick={() => {
                if (reviewTimingOpen) reviewTiming.resetDraft();
                setReviewTimingOpen((value) => !value);
              }}
              aria-expanded={reviewTimingOpen}
            >
              <span>
                <strong>Proactive review timing</strong>
                <small>{reviewTiming.proactiveDelaySeconds}s debounce · {reviewTiming.proactiveTimeoutSeconds}s timeout</small>
              </span>
              <Icon name="chevronDown" size={15} />
            </button>
            {reviewTimingOpen && (
              <div className="provider-config-content settings-timing-content">
                <p className="settings-option-description">
                  Tune how quickly Archimedes reviews changes while proactive mode is enabled.
                </p>
                <div className="settings-timing-grid">
                  <label>
                    <span className="settings-inline-label">
                      <span>Debounce after changes</span>
                      <AppTooltip label="How long to wait after the latest meaningful diagram change before starting a proactive review.">
                        <button type="button" className="settings-help-icon" aria-label="Debounce timing information">
                          <Icon name="info" size={13} />
                        </button>
                      </AppTooltip>
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      step="1"
                      value={reviewTiming.draftDelaySeconds}
                      onChange={(event) => reviewTiming.updateDraftDelaySeconds(event.target.value)}
                    />
                    <small>Seconds after the last edit.</small>
                  </label>
                  <label>
                    <span className="settings-inline-label">
                      <span>Maximum wait timeout</span>
                      <AppTooltip label="The longest unsent diagram changes can wait before a proactive review is forced, even during continuous edits.">
                        <button type="button" className="settings-help-icon" aria-label="Maximum wait timeout information">
                          <Icon name="info" size={13} />
                        </button>
                      </AppTooltip>
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      step="1"
                      value={reviewTiming.draftTimeoutSeconds}
                      onChange={(event) => reviewTiming.updateDraftTimeoutSeconds(event.target.value)}
                    />
                    <small>Seconds before forcing a review.</small>
                  </label>
                </div>
                <div className="provider-config-actions">
                  <button
                    type="button"
                    onClick={() => {
                      reviewTiming.saveReviewTiming();
                      setReviewTimingOpen(false);
                    }}
                  >
                    <Icon name="check" size={15} />
                    Save timing
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="settings-option-card">
            <span className="settings-option-icon" aria-hidden="true">
              <Icon name="message" size={16} />
            </span>
            <div className="settings-option-copy">
              <div className="settings-option-title-row">
                <span className="settings-option-title">Use chat history for auto reviews</span>
                <AppTooltip label="When enabled, previous chat and review messages are sent to the LLM during proactive reviews. This can consume more tokens.">
                  <button type="button" className="settings-help-icon" aria-label="Previous messages will be sent to the LLM and can consume more tokens.">
                    <Icon name="info" size={13} />
                  </button>
                </AppTooltip>
              </div>
              <p className="settings-option-description">
                Off by default. Enable only if proactive reviews should consider the previous conversation.
              </p>
              <span className="settings-option-warning">May increase token usage</span>
            </div>
            <button
              type="button"
              className="settings-switch"
              role="switch"
              aria-checked={settings.includeHistoryInProactiveReviews}
              aria-label="Include chat history in proactive reviews"
              data-state={settings.includeHistoryInProactiveReviews ? 'on' : 'off'}
              onClick={() =>
                onSettingsChange({
                  ...settings,
                  includeHistoryInProactiveReviews: !settings.includeHistoryInProactiveReviews,
                })
              }
            >
              <span className="settings-switch-thumb" />
            </button>
          </div>
          <div className="settings-bottom-actions">
            <AppTooltip label={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
              <button
                type="button"
                className="theme-footer-button"
                onClick={() => onSettingsChange({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}
                aria-label={settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                <Icon name={settings.theme === 'dark' ? 'sun' : 'moon'} size={15} />
                <span>{settings.theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
              </button>
            </AppTooltip>
            <footer className="settings-footer">
              <span>Built by <a href={X_PROFILE_URL} target="_blank" rel="noreferrer">Shashank Harikripa</a></span>
              <nav className="settings-socials" aria-label="Project links">
                <TooltipIconAction label="Visit project" href={PROJECT_GITHUB_URL} target="_blank" rel="noreferrer">
                  <Icon name="github" size={16} />
                </TooltipIconAction>
                <TooltipIconAction label="Open source attributions" onClick={() => setShowCredits(true)}>
                  <Icon name="eye" size={16} />
                </TooltipIconAction>
              </nav>
            </footer>
          </div>
        </section>
      ) : (
        <>
          <div className="message-list">
            {messages.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-kicker"><Icon name="sparkles" size={14} /> No review yet</span>
                <strong>Draw a system design, then ask Archimedes for a review.</strong>
                <p>Switch to proactive mode for automatic diagram reviews, or keep manual mode and trigger review from the composer.</p>
              </div>
            ) : (
              messages.map((message) => (
                <article key={message.id} className={`message ${message.role} ${message.kind ?? ''}`}>
                  <div className="message-meta">
                    <span>{message.role === 'assistant' ? 'Archimedes' : message.role}</span>
                    {message.kind && <small>{message.kind}</small>}
                  </div>
                  <div className="message-content">
                    <MarkdownMessage content={message.content} />
                  </div>
                </article>
              ))
            )}
          </div>

          <footer className="composer">
            <div className="composer-options">
              <AppTooltip label="Thinking level">
                <div className="thinking-control">
                  <Icon name="brain" size={15} />
                  <CustomSelect
                    ariaLabel="Thinking level"
                    value={settings.thinkingLevel}
                    options={THINKING_OPTIONS}
                    onChange={(value) => onSettingsChange({ ...settings, thinkingLevel: value as ThinkingLevel })}
                    disabled={isBusy}
                    className="thinking-select"
                  />
                </div>
              </AppTooltip>
              <AppTooltip label="Clear chat">
                <button
                  type="button"
                  className="composer-clear-button clear-button"
                  onClick={onClearChat}
                  disabled={isBusy || messages.length === 0}
                  aria-label="Clear chat"
                >
                  <Icon name="trash" size={15} />
                </button>
              </AppTooltip>
            </div>

            <div className="composer-input-wrap">
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Ask about the diagram, tradeoffs, scaling, security..."
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
                }}
              />
            </div>

            <div className="composer-action-row">
              <AppTooltip label={settings.autoReview ? 'Currently proactive. Click for manual.' : 'Currently manual. Click for proactive.'}>
                <button
                  type="button"
                  onClick={() => onSettingsChange({ ...settings, autoReview: !settings.autoReview })}
                  className={`input-corner-toggle ${settings.autoReview ? 'proactive-button' : 'manual-button'}`}
                  aria-label={settings.autoReview ? 'Switch to manual review' : 'Switch to proactive review'}
                  disabled={isBusy}
                >
                  <Icon name={settings.autoReview ? 'zap' : 'user'} size={14} />
                  <span>{settings.autoReview ? 'Proactive' : 'Manual'}</span>
                </button>
              </AppTooltip>
              <button
                className={`send-button unified-action-button input-action-button ${prompt.trim() ? 'send-mode' : 'review-mode'}`}
                onClick={() => (prompt.trim() ? submit() : onReview())}
                disabled={isBusy}
                aria-label={prompt.trim() ? 'Send message' : 'Review diagram'}
              >
                <span className="action-icon-segment">
                  <Icon name={prompt.trim() ? 'send' : 'sparkles'} size={15} />
                </span>
                <span>{isBusy ? 'Thinking' : prompt.trim() ? 'Send' : 'Review'}</span>
              </button>
            </div>
          </footer>
        </>
      )}
      {showOllamaSetup && (
        <div className="credits-backdrop" role="presentation" onMouseDown={() => setShowOllamaSetup(false)}>
          <section
            className="credits-modal ollama-setup-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ollama-setup-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="credits-modal-header">
              <div>
                <p className="credits-kicker">Local Ollama</p>
                <h2 id="ollama-setup-title">Set up a vision-supported model</h2>
              </div>
              <button type="button" className="credits-close-button" onClick={() => setShowOllamaSetup(false)} aria-label="Close Ollama setup">
                <Icon name="x" size={15} />
              </button>
            </header>
            <div className="credits-scroll ollama-setup-scroll">
              <div className="ollama-setup-content">
                <p>
                  Archimedes needs an Ollama model with image/vision support so it can inspect your diagrams. Browse the live Ollama catalogue here:{' '}
                  <a href={OLLAMA_VISION_MODELS_URL} target="_blank" rel="noreferrer">open all vision models</a>.
                </p>

                <div className="setup-steps" aria-label="Ollama setup steps">
                  <article>
                    <span>1</span>
                    <div>
                      <h3>Install Ollama</h3>
                      <p>Install Ollama from <a href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com/download</a>. If Ollama is already running, quit it before restarting with the allowed site below.</p>
                    </div>
                  </article>
                  <article>
                    <span>2</span>
                    <div>
                      <h3>Allow this site to connect</h3>
                      <p>Because this page is running from <code>{currentSiteOrigin}</code>, Ollama must allow that browser origin before Archimedes can call your local model.</p>
                      <div className="ollama-os-tabs" role="tablist" aria-label="Operating system instructions">
                        {OLLAMA_OS_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            role="tab"
                            aria-selected={ollamaOriginInstructions.selectedOs === option.value}
                            className="ollama-os-tab"
                            data-active={ollamaOriginInstructions.selectedOs === option.value ? 'true' : 'false'}
                            onClick={() => ollamaOriginInstructions.setSelectedOs(option.value)}
                          >
                            {option.label}
                            {ollamaOriginInstructions.detectedOs === option.value && <span>Detected</span>}
                          </button>
                        ))}
                      </div>
                      <div className="ollama-os-instructions" role="tabpanel">
                        <p>{ollamaOriginInstructions.selectedInstruction.description}</p>
                        <div className="ollama-quit-instructions">
                          <strong>Quit Ollama if it is already running:</strong>
                          <ul>
                            {ollamaOriginInstructions.selectedInstruction.quitSteps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ul>
                          {ollamaOriginInstructions.selectedInstruction.quitCommand && renderCopyableCommand(ollamaOriginInstructions.selectedInstruction.quitCommand)}
                        </div>
                        <div className="ollama-persist-instructions">
                          <strong>Add the origin permanently</strong>
                          <p>{ollamaOriginInstructions.selectedInstruction.permanentNote}</p>
                          {renderCopyableCommand(ollamaOriginInstructions.selectedInstruction.permanentCommand)}
                          <strong className="ollama-inline-heading">
                            <span>Temporary: run Ollama in the background</span>
                            <AppTooltip label="This starts Ollama once with the allowed site, without saving the setting permanently. You may need to run it again after Ollama stops, you sign out, or your computer restarts.">
                              <button type="button" className="settings-help-icon" aria-label="Temporary background Ollama information">
                                <Icon name="info" size={13} />
                              </button>
                            </AppTooltip>
                          </strong>
                          <p>Use this only if you do not want to permanently save the allowed site.</p>
                          {renderCopyableCommand(ollamaOriginInstructions.selectedInstruction.backgroundCommand)}
                        </div>
                      </div>
                    </div>
                  </article>
                  <article>
                    <span>3</span>
                    <div>
                      <h3>Pick a model for your hardware</h3>
                      <p>Use the recommended Gemma command below, or choose any other tag from the vision model list if your hardware or quality requirements differ.</p>
                    </div>
                  </article>
                  <article>
                    <span>4</span>
                    <div>
                      <h3>Save</h3>
                      <p>Enter the exact model tag in Settings, keep the endpoint as <code>http://localhost:11434</code> unless you changed it, then click <strong>Save</strong>.</p>
                    </div>
                  </article>
                </div>

                <div className="vision-model-list">
                  {RECOMMENDED_VISION_MODELS.map((model) => (
                    <article className="vision-model-card" key={model.tag}>
                      <div>
                        <div className="vision-model-heading">
                          <h3>{model.name}</h3>
                        </div>
                        <p>{model.bestFor}</p>
                      </div>
                      {renderCopyableCommand(model.command)}
                      <div className="vision-model-actions">
                        <a href={model.url} target="_blank" rel="noreferrer">View model</a>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="ollama-setup-tip">
                  <p>Recommended command:</p>
                  {renderCopyableCommand('ollama pull gemma4:e4b')}
                  <p>Copy and run it, then enter <code>gemma4:e4b</code> in the Model field. If you pick a different vision model from the catalogue, use its exact tag in both the pull command and the Model field.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
      {showCredits && (
        <div className="credits-backdrop" role="presentation" onMouseDown={() => setShowCredits(false)}>
          <section
            className="credits-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="credits-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="credits-modal-header">
              <div>
                <p className="credits-kicker">Open source</p>
                <h2 id="credits-title">Open source attributions</h2>
              </div>
              <button type="button" className="credits-close-button" onClick={() => setShowCredits(false)} aria-label="Close open source attributions">
                <Icon name="x" size={15} />
              </button>
            </header>
            <div className="credits-scroll">
              <p className="credits-intro">Archimedes Agent is built with these open source libraries and tools.</p>
              <div className="credits-list">
                {OPEN_SOURCE_CREDITS.map((credit) => (
                  <article className="credit-card" key={credit.packageName}>
                    <div>
                      <h3>{credit.name}</h3>
                      <p>{credit.note}</p>
                    </div>
                    <dl>
                      <div>
                        <dt>Package</dt>
                        <dd>{credit.packageName}</dd>
                      </div>
                      <div>
                        <dt>License</dt>
                        <dd>{credit.license}</dd>
                      </div>
                    </dl>
                    <a href={credit.url} target="_blank" rel="noreferrer">Visit project</a>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </aside>
  );
}
