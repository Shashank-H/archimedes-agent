# Plan: Add OpenAI-compatible provider support

## Context

The app currently talks directly to Ollama from the React frontend. The core agent flow is otherwise provider-agnostic: Excalidraw is exported to a base64 PNG, a compact diagram metadata summary is generated, and chat/review/proactive modes all send the same two-message prompt shape to the LLM.

Initial feasibility finding: supporting OpenAI-supported/OpenAI-compatible chat endpoints looks like a modest provider abstraction + settings/UI change, not a full application revamp **if** the endpoint can be called directly from the frontend (for example local OpenAI-compatible servers or endpoints that allow browser/webview CORS). For robust official cloud OpenAI support, there is one bigger integration concern: the current app calls LLM APIs directly from React, while cloud APIs commonly require secret handling and may block browser CORS. That can be solved without revamping the UI/diagram logic, but may require a small Tauri-side request proxy/command for packaged desktop builds.

The main model caveat is vision: this app depends on image input, so the selected OpenAI/OpenAI-compatible model and endpoint must support multimodal chat messages.

## Approach

Add a small LLM provider layer that keeps the current Ollama client but introduces an OpenAI-compatible client for `/v1/chat/completions` streaming. Convert the existing internal message shape from Ollama's `{ content, images }` format into OpenAI's content-part format, where the diagram image is sent as an `image_url` data URL alongside text.

Recommended UX based on current direction: keep one provider/endpoint section rather than a large setup revamp. Conceptually it can be the same endpoint input field, but the app still needs to know the selected API shape (`ollama` vs `openai-compatible`) because the request path, headers, streaming parser, image payload format, model-list/test endpoint, and error handling differ. OpenAI-compatible mode adds an optional API key field stored in localStorage for the first implementation. Ollama remains the local-first default.

## Files to modify

- `src/types.ts` — add provider-specific settings, likely `provider`, `openaiBaseUrl`, `openaiApiKey`, and possibly provider-specific model defaults.
- `src/lib/storage.ts` — continue merging saved settings with new defaults for backward-compatible migrations.
- `src/lib/llm/ollama.ts` — keep existing Ollama behavior, possibly rename exported shared message/types.
- `src/lib/llm/openai.ts` — new OpenAI-compatible streaming client and connection test.
- `src/lib/llm/index.ts` or `src/lib/llm/provider.ts` — choose provider and expose one `streamChat`/`testConnection` API to `App.tsx`.
- `src/App.tsx` — stop importing Ollama directly; use provider abstraction for build/send/test/status/error copy.
- `src/components/AssistantPanel.tsx` — update settings labels, provider selector, API key input, setup/help copy, privacy note, and test button text.
- `README.md` and possibly `docs/` — document how to configure Ollama vs OpenAI-compatible endpoints and vision-capable models.
- `src-tauri/tauri.conf.json` and/or `src-tauri/src/` — only if official/cloud endpoints must work reliably despite browser CORS/secret concerns; this would add a Tauri-side HTTP proxy/command rather than changing the diagram app architecture.

## Reuse

- `src/lib/diagramImage.ts` already exports base64 PNGs; OpenAI can reuse this by wrapping it as `data:image/png;base64,...`.
- `src/lib/diagramSummary.ts` and `src/lib/llm/prompts.ts` remain unchanged.
- `src/App.tsx` already centralizes all LLM calls in `buildImageMessages`, `runAgentReview`, and `handleTestConnection`; this limits the integration surface.
- `src/lib/storage.ts` already handles additive settings migrations by merging parsed settings over defaults.

## Steps

- [x] Define a neutral internal chat message type that can carry text plus optional diagram image base64/mime type.
- [x] Add `provider`, endpoint/base URL, optional localStorage API key, and OpenAI-compatible defaults to `AppSettings` while preserving existing Ollama settings.
- [x] Implement an OpenAI-compatible streaming client for `POST {baseUrl}/chat/completions` with `stream: true`, optional `Authorization: Bearer <apiKey>`, model, temperature, and multimodal `messages`.
- [x] Handle SSE streaming chunks (`data: ...`, `[DONE]`) and append `choices[0].delta.content` tokens.
- [x] Add a provider dispatcher so `App.tsx` calls one `streamLlmChat` and one `testLlmConnection` API.
- [x] Update status/error messages to refer to the selected provider instead of hard-coding Ollama.
- [x] Update settings UI with an API-shape/provider selector, one endpoint/base URL field, model field, optional API key field, and provider-aware test button/copy.
- [x] Update docs with examples for Ollama and OpenAI-compatible providers, including the requirement for a vision-capable model.

## Verification

- [x] Run TypeScript build (`npm run build`) to catch type and API-shape issues.
- [ ] Verify existing Ollama manual review, chat, proactive review, and connection test still work. Connection test works; generation currently blocked locally by Ollama CUDA OOM, not by TypeScript/API shape.
- [ ] Verify OpenAI-compatible manual review streams text back from a vision-capable model. Local Ollama OpenAI-compatible endpoint is reachable but generation is blocked by CUDA OOM for `gemma4:e4b`; no external API key was available in this environment.
- [x] Verify whether the target endpoint works from the current browser/frontend fetch path; if not, verify the Tauri-side proxy path instead. Direct frontend-style HTTP path is implemented; local OpenAI-compatible endpoint responds, so no proxy was added yet.
- [x] Verify OpenAI-compatible chat includes the current diagram image and metadata. Confirmed by implementation: `LlmChatMessage.images` becomes OpenAI `image_url` data URL and prompt content includes metadata.
- [x] Verify missing/invalid API key, unsupported vision model, and unreachable endpoint produce clear errors. Errors include provider name, endpoint, model/API-key guidance, and vision-capable model guidance; exact provider messages depend on endpoint response.
- [x] Confirm saved old settings still load with sane defaults for new fields.

## Open questions

- None blocking. During implementation, validate direct frontend calls against the chosen cloud endpoint; if the endpoint blocks browser/webview CORS, add the small Tauri-side proxy fallback described above.

## Resolved decisions

- First target: generic OpenAI-compatible base URL, not only official OpenAI.
- API key handling for first implementation: localStorage is acceptable.
- Endpoint field: keep the UX close to the current single endpoint field, but add an API-shape/provider selector because Ollama and OpenAI-compatible APIs are not wire-compatible.
- Runtime priority: direct frontend calls are acceptable for the first implementation, with a proxy fallback only if real endpoint testing proves it necessary.
