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
import { useCodexAuth } from '../../hooks/useCodexAuth';
import { useReviewTimingSettings } from '../../hooks/useReviewTimingSettings';
import type { LlmProvider } from '../../types';
import { LINKEDIN_PROFILE_URL, OLLAMA_OS_OPTIONS, OLLAMA_VISION_MODELS_URL, OPEN_SOURCE_CREDITS, PERSONAL_SITE_URL, PROJECT_GITHUB_URL, RECOMMENDED_VISION_MODELS, X_PROFILE_URL } from './constants';
import { SETTINGS_SECTIONS, type SettingsSectionId } from './settingsSections';
import { useOllamaOriginInstructions } from './hooks/useOllamaOriginInstructions';

function getInitialSettingsSectionId(): SettingsSectionId {
  if (typeof window === 'undefined') return 'provider';
  const hashSectionId = window.location.hash.replace(/^#settings-/, '') as SettingsSectionId;
  return SETTINGS_SECTIONS.some((section) => section.id === hashSectionId) ? hashSectionId : 'provider';
}

export function SettingsPage() {
  const { settings, handleSettingsChange: onSettingsChange } = useWorkspace();
  const {
    isBusy,
    currentModelValidationError: modelValidationError,
    handleTestConnection: onTestConnection,
  } = useChat();
  const [activeSectionId, setActiveSectionId] = useState<SettingsSectionId>(getInitialSettingsSectionId);
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
  const codexAuth = useCodexAuth({ settings, onSettingsChange });
  const reviewTiming = useReviewTimingSettings({ settings, onSettingsChange });
  const currentSiteOrigin = typeof window === 'undefined' ? 'https://this-site.example' : window.location.origin;
  const ollamaOriginInstructions = useOllamaOriginInstructions(currentSiteOrigin);



  useEffect(() => {
    const handleHashChange = () => setActiveSectionId(getInitialSettingsSectionId());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
    await onTestConnection();
  };

  const openSection = (sectionId: SettingsSectionId) => {
    setActiveSectionId(sectionId);
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#settings-${sectionId}`);
    }
  };

  const sectionClassName = (sectionId: SettingsSectionId) => (
    `settings-editor-section${activeSectionId === sectionId ? ' is-active' : ' is-hidden'}`
  );

  const renderSectionHeader = (sectionId: SettingsSectionId) => {
    const section = SETTINGS_SECTIONS.find((candidate) => candidate.id === sectionId);
    if (!section) return null;

    return (
      <header className="settings-editor-section-header">
        <p className="settings-editor-eyebrow">{section.eyebrow}</p>
        <h2>{section.title}</h2>
        <p>{section.description}</p>
      </header>
    );
  };

  return (
    <>
    <section className={`settings-section settings-editor-page ${settingsPageStyles.moduleAnchor}`}>
      <aside className="settings-editor-sidenav" aria-label="App settings sections">
        <nav>
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={activeSectionId === section.id ? 'is-active' : undefined}
              onClick={() => openSection(section.id)}
            >
              <Icon name={section.iconName} size={15} />
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <div className="settings-editor-scroll">
        <section id="settings-provider" className={sectionClassName('provider')}>
          {renderSectionHeader('provider')}
          <div className="settings-editor-card provider-config-content">
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
                {settings.provider === 'openai-codex' && (
                  <div className="settings-option-card codex-auth-card">
                    <div className="codex-auth-main">
                      <span className="settings-option-icon codex-auth-icon" aria-hidden="true">
                        <Icon name={codexAuth.isSignedIn ? 'check' : 'plug'} size={16} />
                      </span>
                      <div className="settings-option-copy">
                        <div className="settings-option-title-row codex-auth-title-row">
                          <span className="settings-option-title">ChatGPT OAuth</span>
                          <span className={`codex-auth-pill${codexAuth.isSignedIn ? ' is-connected' : ''}`}>
                            {codexAuth.isSignedIn ? 'Connected' : codexAuth.isSigningIn ? 'Waiting for browser' : 'Not connected'}
                          </span>
                        </div>
                        <p className="settings-option-description">
                          Sign in with ChatGPT to use OpenAI Codex models. The device code is copied automatically and tokens stay local to this app.
                        </p>
                      </div>
                    </div>

                    {codexAuth.deviceAuth && (
                      <div className="codex-device-panel" aria-live="polite">
                        <div className="codex-device-copy">
                          <span className="codex-device-kicker">Device code</span>
                          <code className="codex-device-code">{codexAuth.deviceAuth.userCode}</code>
                          <span className="codex-device-helper">
                            {codexAuth.deviceCodeCopied ? 'Copied — paste this in the browser.' : 'Paste this code in the ChatGPT browser window.'}
                          </span>
                        </div>
                        <div className="codex-device-actions">
                          <button type="button" className="codex-inline-button" onClick={() => void codexAuth.copyDeviceCode()}>
                            <Icon name={codexAuth.deviceCodeCopied ? 'check' : 'copy'} size={14} />
                            {codexAuth.deviceCodeCopied ? 'Copied' : 'Copy code'}
                          </button>
                          <button type="button" className="codex-inline-button" onClick={() => void codexAuth.openDeviceAuthUrl()}>
                            <Icon name="openExternal" size={14} />
                            Open page
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="codex-auth-footer">
                      <div className="codex-auth-messages">
                        {codexAuth.status && <p className="settings-option-description codex-auth-status">{codexAuth.status}</p>}
                        {codexAuth.error && <p className="settings-field-error">{codexAuth.error}</p>}
                      </div>
                      <button
                        type="button"
                        className="secondary-settings-button codex-auth-button"
                        onClick={codexAuth.isSignedIn ? codexAuth.signOut : codexAuth.startSignIn}
                        disabled={codexAuth.isSigningIn && !codexAuth.deviceAuth}
                      >
                        <Icon name={codexAuth.isSignedIn ? 'x' : 'plug'} size={15} />
                        {codexAuth.isSigningIn ? 'Restart sign-in' : codexAuth.isSignedIn ? 'Sign out' : 'Sign in with ChatGPT'}
                      </button>
                    </div>
                  </div>
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
        </section>
        <section id="settings-assistant" className={sectionClassName('assistant')}>
          {renderSectionHeader('assistant')}
          <div className="settings-editor-card settings-timing-content">
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
                    }}
                  >
                    <Icon name="check" size={15} />
                    Save timing
                  </button>
                </div>
          </div>
          <div className="settings-editor-card settings-option-card">
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
        </section>
        <section id="settings-shortcuts" className={sectionClassName('shortcuts')}>
          {renderSectionHeader('shortcuts')}
          <div className="settings-editor-card settings-shortcuts-list">
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
        </section>
        <section id="settings-appearance" className={sectionClassName('appearance')}>
          {renderSectionHeader('appearance')}
          <div className="settings-editor-card">
            <label className="settings-select-label">
              Theme
              <CustomSelect
                ariaLabel="Theme"
                value={settings.theme}
                options={[
                  { value: 'system', label: 'System (follow OS)' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'coffee', label: 'Coffee (warm dark)' },
                ]}
                onChange={(value) => onSettingsChange({ ...settings, theme: value as any })}
                className="settings-theme-select"
              />
            </label>
            <p className="settings-hint">Multiple color themes supported. “System” follows your OS preference and updates live.</p>
          </div>
        </section>
        <section id="settings-privacy" className={sectionClassName('privacy')}>
          {renderSectionHeader('privacy')}
          <div className="settings-editor-card usage-logs-modal-body">
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
        </section>
        <section id="settings-about" className={sectionClassName('about')}>
          {renderSectionHeader('about')}
          <div className="settings-editor-card settings-about-card">
            <span className="settings-author-credit">Built by <a href={PERSONAL_SITE_URL} target="_blank" rel="noreferrer">Shashank Harikripa</a></span>
            <nav className="settings-socials" aria-label="Project links">
              <TooltipIconAction label="Visit X profile" href={X_PROFILE_URL} target="_blank" rel="noreferrer">
                <Icon name="xSocial" size={15} />
              </TooltipIconAction>
              <TooltipIconAction label="Visit LinkedIn profile" href={LINKEDIN_PROFILE_URL} target="_blank" rel="noreferrer">
                <Icon name="linkedin" size={15} />
              </TooltipIconAction>
              <TooltipIconAction label="Visit project" href={PROJECT_GITHUB_URL} target="_blank" rel="noreferrer">
                <Icon name="github" size={16} />
              </TooltipIconAction>
            </nav>
          </div>
          <div className="settings-editor-card credits-scroll">
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
    </section>
      <AppDialog
        open={showOllamaSetup}
        onOpenChange={setShowOllamaSetup}
        className="credits-modal ollama-setup-modal"
        labelledBy="ollama-setup-title"
      >
        <header className="credits-modal-header">
          <div>
            <p className="credits-kicker">Local models</p>
            <AppDialogTitle id="ollama-setup-title">Set up a vision-supported Ollama model</AppDialogTitle>
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
    </>
  );
}
