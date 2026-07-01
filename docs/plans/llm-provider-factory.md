# LLM Provider Factory Refactor Plan

## Context
- The LLM layer currently uses object adapters (`ollamaProvider`, `openAiCompatibleProvider`) registered in a provider map.
- The requested direction is to move to an abstract base class pattern where every direct provider implementation extends a shared base LLM provider and instances are selected through a factory.
- The design should also leave room for future agent SDK integrations such as LangGraph/Langraph-style workflows without forcing UI code to know whether the backend is a direct LLM provider or an agent orchestration provider.
- The chat method should not be named `sendChatMessage`; the existing behavior is streaming chat/review responses.
- Current review requests do **not** include prior chat/review turns in the LLM payload: `buildImageMessages` in `src/App.tsx` creates only a system message plus the latest user prompt/image. Older messages are persisted and rendered in the UI, but they are effectively ignored by the model for each new review.
- Future behavior should let the user decide whether prior chat messages are included in proactive reviews. Follow-up chat can use prior messages for continuity, while proactive review context should be controlled by a setting/user choice.
- If a proactive review is triggered after the user changed the image/design since the previous review, the LLM payload should include an explicit text message such as: “The user has changed the design after the previous review. Review the updated design again and compare against the prior feedback where relevant.”

## Approach
- Introduce an abstract `BaseLlmProvider` class that defines the common provider contract for direct model providers.
- Introduce/shape the factory around a broader `LlmRuntime`/`ChatRuntime` contract so direct providers and future agent SDK-backed runtimes can be selected behind the same app-facing API.
- Convert Ollama and OpenAI-compatible implementations into concrete classes extending `BaseLlmProvider`.
- Keep a provider/runtime factory as the only place that maps `AppSettings.provider` to a concrete provider/runtime class/instance.
- Preserve the current public application API where sensible (`streamLlmChat`, `testLlmConnection`, `getProviderStatus`) so `App.tsx` and UI code need minimal changes.
- Name the provider chat operation `streamChat` (not `sendChatMessage`) to match the current streaming behavior.
- Add a conversation-context builder before provider dispatch so follow-up chat can include recent prior `ChatMessage` turns converted to `LlmChatMessage` text messages, plus the latest diagram prompt/image.
- Follow the repository instruction in `AGENTS.md`: page/component changes should use custom hooks so business logic is testable and component markup stays minimal.
- For proactive reviews, make history inclusion a user-controlled setting (for example: include previous review messages always/never/ask before sending), rather than silently sending older messages every time.
- Detect whether the image/design changed since the previous review. When it changed, add an explicit LLM context message explaining that the design was updated after the previous review and asking the model to review the updated design again.
- Keep context assembly outside provider classes; providers and future agent runtimes should only stream whatever normalized request/context object they receive.
- Bound the included history to avoid oversized prompts, and exclude status/error messages from LLM context.

## Files to modify
- `src/lib/llm/provider.ts` for the base provider, runtime contract, and factory exports.
- `src/lib/llm/ollama.ts`
- `src/lib/llm/openai.ts`
- `src/App.tsx` only for minimal wiring/rendering changes that call custom hooks and consume hook state/actions.
- A new or existing hook file under `src/` (for example `src/hooks/useLlmReviewContext.ts` or similar) to build request context, honor the user's proactive-review history preference, and add the “design changed after previous review” message when applicable.
- `src/types.ts` if adding future provider/runtime identifiers, context-window settings, proactive-review history preference, or moving provider metadata requires changing shared types.
- Potentially `src/components/AssistantPanel.tsx` only for minimal rendering changes; any provider option/default logic should move into a hook rather than staying inline in the component.
- Potentially `src/lib/storage.ts` if provider-specific defaults/migrations should become provider metadata instead of inline conditionals.

## Reuse
- Reuse existing stream request/response parsing logic in `src/lib/llm/ollama.ts`.
- Reuse existing OpenAI-compatible request, SSE parsing, and auth helpers in `src/lib/llm/openai.ts`.
- Reuse existing connection-test result shape and UI helpers in `src/lib/llm/provider.ts`.
- Reuse existing app call sites in `src/App.tsx`: `streamLlmChat`, `testLlmConnection`, `getProviderName`, and `getProviderStatus`.
- Reuse persisted `ChatMessage[]` from `src/App.tsx` / `src/lib/storage.ts` as the source for prior text context when the current request type and user preference allow it, while filtering out non-conversational status/error entries.
- Reuse existing settings persistence in `src/lib/storage.ts`, while noting that provider defaults are currently hardcoded both there and in `AssistantPanel.tsx`.

## Steps
- [x] Confirm naming and extensibility expectations.
- [x] Define the abstract base provider contract for direct providers and a broader app-facing runtime interface that can later wrap agent SDKs such as LangGraph without changing UI call sites.
- [x] Add a user setting/control for whether proactive reviews include previous chat/review messages.
- [x] Implement the history-to-LLM-message conversion in a custom hook/helper, not inline in `App.tsx`, so older user/assistant review messages can be considered by the model when allowed by request type and user preference.
- [x] Track or compare enough image/design state in a custom hook/helper to know when a proactive review is running against a changed design, then add a specific context message telling the LLM the design changed after the previous review and should be reviewed again.
- [x] Convert Ollama adapter object into an `OllamaProvider` class.
- [x] Convert OpenAI-compatible adapter object into an `OpenAiCompatibleProvider` class.
- [x] Implement/update the factory that returns the appropriate runtime for current settings: direct `BaseLlmProvider` subclasses now, and future agent SDK-backed runtime classes later.
- [x] Preserve or update exported helper functions used by the app.
- [x] Decide whether provider metadata (`label`, default endpoint, default model, API-key visibility) remains in the UI/storage or moves into the provider classes/factory.
- [x] Add documentation/comments showing how future direct providers should extend the base class and register with the factory, and how future agent SDK runtimes should implement the app-facing runtime contract.
- [x] Keep page/component changes thin by moving request orchestration, derived state, side effects, and provider-setting decisions into custom hooks per `AGENTS.md`.

## Verification
- [x] Run `npm run build` to validate TypeScript and Vite build.
- [x] Unit-test custom hooks/helpers for context building, proactive-review history preference, and design-change messaging where test infrastructure allows.
- [ ] Manually test Ollama connection and streaming diagram review/chat.
- [ ] Manually test OpenAI-compatible connection and streaming diagram review/chat.
- [ ] Confirm UI labels/status still show provider name and model correctly.
- [ ] Run a manual sequence: ask for a review, then ask a follow-up that depends on the prior answer; verify the second LLM request includes the earlier user/assistant turns and the model responds with continuity.
- [ ] Test proactive review with history disabled; verify older chat messages are not sent.
- [ ] Test proactive review with history enabled/approved; verify allowed prior messages are sent.
- [ ] Change the design/image after a review and trigger proactive review; verify the LLM payload includes the explicit “design changed after previous review” context message.
