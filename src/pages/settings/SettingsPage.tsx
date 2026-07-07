import { useEffect, useId, useRef, useState } from 'react';
import settingsPageStyles from './SettingsPage.module.css';
import { AppDialog, AppDialogTitle } from '../../components/ui/AppDialog';
import { AppSwitch } from '../../components/ui/AppSwitch';
import { Icon } from '../../components/ui/icons';
import { useChat } from '../../providers/chat/ChatContext';
import { KEYBOARD_SHORTCUTS } from '../../providers/shortcuts/constants';
import { useWorkspace } from '../../providers/workspace/WorkspaceContext';
import { AppTooltip } from '../../components/AppTooltip';
import { CustomSelect } from '../../components/CustomSelect';
import { TooltipIconAction } from '../../components/TooltipIconAction';
import { useProviderSettings } from '../../hooks/useProviderSettings';
import { useModelSelection } from '../../hooks/useModelSelection';
import { useMaskedApiKeyInput } from '../../hooks/useMaskedApiKeyInput';
import { useReviewTimingSettings } from '../../hooks/useReviewTimingSettings';
import { settingsValidationKey } from '../../lib/settingsValidation';
import type { LlmProvider } from '../../types';
import { OLLAMA_OS_OPTIONS, OLLAMA_VISION_MODELS_URL, OPEN_SOURCE_CREDITS, PROJECT_GITHUB_URL, RECOMMENDED_VISION_MODELS, X_PROFILE_URL } from './constants';
import { useChatGptSubscriptionAuth } from '../../hooks/useChatGptSubscriptionAuth';
import { ChatGptSubscriptionAuthCard } from './components/ChatGptSubscriptionAuthCard';
import { SettingsAccordion } from './components/SettingsAccordion';
import { useOllamaOriginInstructions } from './hooks/useOllamaOriginInstructions';

export function SettingsPage() {
  const { settings, handleSettingsChange: onSettingsChange } = useWorkspace();
  const {
    isBusy,
    currentModelValidationError: modelValidationError,
    handleTestConnection: onTestConnection,
  } = useChat();
  const providerConfigurationKey = settingsValidationKey(settings);
  const providerConfigurationIsTested = settings.providerConfigurationTestedKey === providerConfigurationKey;
  const [showCredits, setShowCredits] = useState(false);
  const [showUsageLogsInfo, setShowUsageLogsInfo] = useState(false);
  const [providerConfigOpen, setProviderConfigOpen] = useState(!providerConfigurationIsTested);
  const [reviewTimingOpen, setReviewTimingOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showOllamaSetup, setShowOllamaSetup] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
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
  const chatGptSubscriptionAuth = useChatGptSubscriptionAuth(settings, onSettingsChange);
  const chatGptSubscriptionReady = settings.provider !== 'chatgpt-subscription' || Boolean(chatGptSubscriptionAuth.credentials);
  const currentSiteOrigin = typeof window === 'undefined' ? 'https://this-site.example' : window.location.origin;
  const ollamaOriginInstructions = useOllamaOriginInstructions(currentSiteOrigin);


  useEffect(() => {
    setProviderConfigOpen(!providerConfigurationIsTested);
  }, [providerConfigurationIsTested, providerConfigurationKey]);

  useEffect(() => {
    if (!showCredits && !showOllamaSetup && !showUsageLogsInfo) return;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setShowCredits(false);
      setShowOllamaSetup(false);
      setShowUsageLogsInfo(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCredits, showOllamaSetup, showUsageLogsInfo]);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);


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
    <>
      <section className={`settings-section ${settingsPageStyles.moduleAnchor}`}>
          <SettingsAccordion
            open={providerConfigOpen}
            onOpenChange={setProviderConfigOpen}
            title="Provider configuration"
            summary={`${providerMetadata.label} · ${settings.model}`}
          >
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
                {settings.provider === 'chatgpt-subscription' && (
                  <ChatGptSubscriptionAuthCard auth={chatGptSubscriptionAuth} isBusy={isBusy} />
                )}
                {settings.provider !== 'chatgpt-subscription' && (
                <label>
                  Endpoint / base URL
                  <input
                    value={settings.endpoint}
                    placeholder={endpointPlaceholder}
                    onChange={(event) => updateEndpoint(event.target.value)}
                  />
                </label>
                )}
                {settings.provider === 'chatgpt-subscription' && (
                  <p className="settings-hint">
                    Uses OpenAI Codex subscription API at <code>{endpointPlaceholder}</code> (same as Hermes <code>openai-codex</code> / Codex CLI).
                    Models are loaded from <code>/models</code> on that host after sign-in.
                  </p>
                )}
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
                  <button onClick={handleSaveProviderConfiguration} disabled={isBusy || !chatGptSubscriptionReady}>
                    <Icon name="plug" size={15} />
                    {testConnectionLabel}
                  </button>
                </div>
          </SettingsAccordion>
          <SettingsAccordion
            open={reviewTimingOpen}
            onOpenChange={setReviewTimingOpen}
            onClosing={reviewTiming.resetDraft}
            title="Proactive review timing"
            summary={`${reviewTiming.proactiveDelaySeconds}s debounce · ${reviewTiming.proactiveTimeoutSeconds}s timeout`}
          >
              <div className="settings-timing-content">
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
          </SettingsAccordion>
          <SettingsAccordion
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
            title="Keyboard shortcuts"
            summary={`${KEYBOARD_SHORTCUTS.length} active shortcut${KEYBOARD_SHORTCUTS.length === 1 ? '' : 's'}`}
          >
            <div className="settings-shortcuts-list">
              {KEYBOARD_SHORTCUTS.map((shortcut) => (
                <div key={shortcut.id} className="settings-shortcut-row">
                  <div>
                    <strong>{shortcut.label}</strong>
                    <span>{shortcut.description}</span>
                    <small>{shortcut.scopeLabel}</small>
                  </div>
                  <div className="settings-shortcut-keys" aria-label={shortcut.displayKeys.join(' plus ')}>
                    {shortcut.displayKeys.map((key) => <kbd key={key}>{key}</kbd>)}
                  </div>
                </div>
              ))}
            </div>
          </SettingsAccordion>
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
            <AppSwitch
              checked={settings.includeHistoryInProactiveReviews}
              ariaLabel="Include chat history in proactive reviews"
              onCheckedChange={(checked) =>
                onSettingsChange({
                  ...settings,
                  includeHistoryInProactiveReviews: checked,
                })
              }
            />
          </div>
          <div className="settings-bottom-actions">
            <div className="settings-footer-controls">
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
            </div>
            <footer className="settings-footer">
              <div className="settings-footer-main">
                <span className="settings-author-credit">Built by <a href={X_PROFILE_URL} target="_blank" rel="noreferrer">Shashank Harikripa</a></span>
                <nav className="settings-socials" aria-label="Project links">
                  <TooltipIconAction label="Visit project" href={PROJECT_GITHUB_URL} target="_blank" rel="noreferrer">
                    <Icon name="github" size={16} />
                  </TooltipIconAction>
                  <TooltipIconAction label="Open source attributions" onClick={() => setShowCredits(true)}>
                    <Icon name="eye" size={16} />
                  </TooltipIconAction>
                </nav>
              </div>
              <div className="usage-logs-row">
                <p className="usage-logs-disclosure">
                  Sends anonymized usage logs.{' '}
                  <button type="button" onClick={() => setShowUsageLogsInfo(true)}>
                    Learn more
                  </button>
                </p>
              </div>
            </footer>
          </div>
        </section>
      <AppDialog
        open={showOllamaSetup}
        onOpenChange={setShowOllamaSetup}
        className="credits-modal ollama-setup-modal"
        labelledBy="ollama-setup-title"
      >
            <header className="credits-modal-header">
              <div>
                <p className="credits-kicker">Local Ollama</p>
                <AppDialogTitle id="ollama-setup-title">Set up a vision-supported model</AppDialogTitle>
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
                          <strong>Verify the connection</strong>
                          <p>After restarting Ollama, run this. A successful setup should not return <code>403 Forbidden</code>.</p>
                          {renderCopyableCommand(ollamaOriginInstructions.selectedInstruction.verifyCommand)}
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
      </AppDialog>
      <AppDialog
        open={showUsageLogsInfo}
        onOpenChange={setShowUsageLogsInfo}
        className="credits-modal usage-logs-modal"
        labelledBy="usage-logs-title"
      >
            <header className="credits-modal-header">
              <div>
                <p className="credits-kicker">Privacy</p>
                <AppDialogTitle id="usage-logs-title">Anonymous usage logs</AppDialogTitle>
              </div>
              <button type="button" className="credits-close-button" onClick={() => setShowUsageLogsInfo(false)} aria-label="Close usage logs information">
                <Icon name="x" size={15} />
              </button>
            </header>
            <div className="usage-logs-modal-body">
              <p className="usage-logs-assurance">
                We never send your tokens, creds, API keys, prompts, chat text, or diagram content.
              </p>
              <p className="usage-logs-copy">
                Archimedes only sends privacy-aware product telemetry through PostHog, like app load, review start/completion, and connection test status. Keeping this on helps us understand what works and improve the app.
              </p>
              <div className="usage-logs-toggle-row">
                <div>
                  <div className="usage-logs-toggle-title">
                    Send anonymous usage logs <span>Recommended</span>
                  </div>
                  <p>Leaving this enabled helps prioritize fixes without exposing private data.</p>
                </div>
                <AppSwitch
                  checked={settings.sendAnonymizedUsageLogs}
                  ariaLabel="Send anonymized usage logs"
                  onCheckedChange={(checked) =>
                    onSettingsChange({
                      ...settings,
                      sendAnonymizedUsageLogs: checked,
                    })
                  }
                />
              </div>
              {!settings.sendAnonymizedUsageLogs && (
                <p className="usage-logs-opt-out-note">Usage logs are off. You can turn them back on anytime to help improve Archimedes.</p>
              )}
            </div>
      </AppDialog>
      <AppDialog
        open={showCredits}
        onOpenChange={setShowCredits}
        labelledBy="credits-title"
      >
            <header className="credits-modal-header">
              <div>
                <p className="credits-kicker">Open source</p>
                <AppDialogTitle id="credits-title">Open source attributions</AppDialogTitle>
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
      </AppDialog>
    </>
  );
}
