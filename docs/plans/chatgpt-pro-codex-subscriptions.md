# Plan: ChatGPT Pro / Codex Subscription Provider

## Context

The app currently supports direct LLM providers configured by endpoint/model/API key:

- `ollama` for local models.
- `openai-compatible` for OpenAI-compatible HTTP APIs with bearer API keys.

The requested change is to support ChatGPT Pro/Codex-style subscription access via a new provider that authenticates with OAuth instead of requiring an API key.

Initial findings:

- Provider selection and runtime dispatch are centralized in `src/lib/llm/provider.ts`.
- Provider type/configuration is defined in `src/types.ts` as `LlmProvider = 'ollama' | 'openai-compatible'` with `endpoint`, `apiKey`, and `model` fields.
- Settings UI lives in `src/components/AssistantPanel.tsx` and conditionally renders API-key input based on provider metadata.
- `OpenAiCompatibleProvider` in `src/lib/llm/openai.ts` already contains reusable OpenAI chat-completions streaming, message/image conversion, model listing, and connection-test patterns.
- Settings persistence in `src/lib/storage.ts` merges saved settings with defaults and provider-specific configurations.
- Tauri backend is currently minimal (`src-tauri/src/lib.rs`) and only uses `tauri-plugin-opener`; OAuth callback/token exchange support would need new backend commands/dependencies or a web-based device-flow approach.

## Approach

Recommended approach: add a distinct subscription-backed provider, tentatively `chatgpt-subscription`, that uses OAuth/device authorization and stores OAuth tokens separately from API keys. The provider should implement the same `LlmRuntime` contract as existing providers so the rest of the chat/review flow continues to call `llmProviderFactory.streamChat`, `testConnection`, and `listModels`.

Key design goals:

- Keep existing API-key support unchanged.
- Do not overload `apiKey`; model OAuth as explicit auth state/tokens.
- Reuse the existing provider factory, settings panel, model combobox, and OpenAI-compatible message streaming shape where applicable.
- Add UI states for “Sign in”, “Signed in as …”, “Refresh/Reconnect”, and “Sign out” instead of an API-key field.
- Handle token refresh and auth expiry gracefully, with actionable errors in the assistant panel.

## Files to modify

Likely files:

- `src/types.ts` — add provider id and auth/configuration types.
- `src/lib/llm/provider.ts` — register the new provider/runtime.
- `src/lib/llm/base.ts` — extend provider metadata/runtime capabilities if needed for OAuth UI hooks.
- `src/lib/llm/openai.ts` — extract reusable OpenAI request/message helpers if the subscription endpoint can use the same protocol.
- `src/lib/llm/chatgptSubscription.ts` (new) — implement subscription provider runtime.
- `src/hooks/useProviderSettings.ts` — surface OAuth-specific labels/tooltips/actions.
- `src/components/AssistantPanel.tsx` — render OAuth sign-in/status/sign-out controls for the new provider.
- `src/lib/settingsValidation.ts` — include OAuth auth state/token identity in validation key without storing secrets in UI strings.
- `src/lib/storage.ts` — persist non-secret provider config and load defaults safely.
- `src-tauri/src/lib.rs` — add backend commands if using localhost callback/token storage/refresh.
- `src-tauri/Cargo.toml` — add OAuth/HTTP/secure-storage dependencies if using a Tauri backend flow.
- `src/styles.css` — style OAuth controls/status.
- `.env.example` / docs — document OAuth client configuration and setup.

## Reuse

- `src/lib/llm/provider.ts`: existing provider registry and active-configuration switching.
- `src/lib/llm/base.ts`: `LlmRuntime` interface for `streamChat`, `testConnection`, and `listModels`.
- `src/lib/llm/openai.ts`: message/image conversion, streaming SSE parsing, model listing/test patterns, reasoning config concepts if compatible. Do not reuse the OpenAI API host for Codex OAuth tokens.
- `src/components/AssistantPanel.tsx`: provider accordion, model combobox, Save/test flow, status/error messages.
- `src/hooks/useProviderSettings.ts`: provider option/metadata plumbing.
- `src/lib/storage.ts`: default-setting merge and per-provider saved configuration pattern.

## Open questions

1. Which exact upstream auth/API surface should this target: official ChatGPT/Codex subscription OAuth, a local Codex CLI auth file/session, or another provider-compatible bridge?
2. Should OAuth tokens be stored in browser `localStorage` for a web build, or only in the Tauri backend/keychain for desktop builds?
3. Is this intended to support both normal chat/review and Codex-specific agent workflows, or only use the subscription as another LLM chat provider?

## Steps

- [x] Confirm the intended subscription auth/API surface and supported platforms: implement the Codex OAuth device-code flow from `openai-codex.ts` in the web/Tauri frontend.
- [x] Define the new provider id, metadata, default model(s), and auth state types.
- [x] Add provider defaults and storage merge handling for existing users.
- [x] Implement OAuth sign-in flow, token refresh, and sign-out.
- [x] Implement the new `LlmRuntime` provider using the ChatGPT backend Responses surface with Codex OAuth bearer and `ChatGPT-Account-ID` headers.
- [x] Register the provider in `llmProviderFactory`.
- [x] Update settings UI to show OAuth controls instead of API-key input for the subscription provider.
- [x] Update validation/test-connection flow for OAuth-authenticated providers.
- [x] Add implementation notes in this plan.
- [x] Verify existing Ollama and OpenAI-compatible providers still work unchanged at type/build level.

## Implementation notes

- Implemented the Codex device-code flow from `openai-codex.ts` using the same OpenAI OAuth client id, device-auth endpoints, token exchange endpoint, and `chatgpt_account_id` JWT claim extraction.
- The runtime sends Codex OAuth bearer tokens with the `ChatGPT-Account-ID` header used by Codex clients.
- Codex OAuth tokens must call the ChatGPT backend, not the public OpenAI API host: default base `https://chatgpt.com/backend-api/codex`, request path `POST {base}/responses`. Legacy saved subscription endpoints pointing at `https://api.openai.com/v1` are rewritten to the ChatGPT backend to avoid `api.responses.write` scope errors.
- OAuth credentials are stored in the provider-specific settings configuration, separate from API keys.

## Verification

- [x] Run `npm run build`.
- In dev, verify switching between `ollama`, `openai-compatible`, and the new subscription provider preserves each provider’s settings.
- Complete OAuth sign-in, refresh/reconnect, and sign-out manually.
- Send a text-only chat prompt.
- Run an image/diagram review prompt to verify vision payload support or show a clear unsupported-model warning.
- Expire/revoke tokens and confirm the app prompts for reconnect rather than failing silently.
