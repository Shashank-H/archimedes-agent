# React Maintainability Refactor Plan

## Context

The React app currently has several large files, especially `src/components/AssistantPanel.tsx` and `src/App.tsx`, that combine page-level layout, component markup, state management, side effects, request orchestration, settings decisions, and derived state. The goal is to plan a maintainability refactor for the `src` React project only, excluding any story files, by moving toward page/component-based structure and following `AGENTS.md`: stateful/business logic should live in focused custom hooks and reusable infrastructure should stay in services/classes where applicable.

## Approach

Refactor by behavior-preserving extraction rather than redesign. Keep the app's current two-pane layout, but make the top-level React tree page/component based and bind the major UI areas through a shared React context.

Recommended structure:

```txt
src/
  App.tsx                              # extremely light: router + providers only
  app/
    router.tsx                         # React Router route definitions
  providers/
    AppProviders.tsx                   # composes all providers
    workspace/
      WorkspaceProvider.tsx
      WorkspaceContext.tsx             # shared state/actions for canvas + assistant
      hooks/
        useWorkspaceController.ts      # settings/messages/review orchestration
        useDiagramSnapshot.ts          # snapshot refs + debounced scene persistence
        useAgentReview.ts              # manual/chat/proactive review workflow
    ui/
      AssistantPanelProvider.tsx       # optional shared right-sidebar UI state
      AssistantPanelContext.tsx
  pages/
    workspace/
      WorkspacePage.tsx
      WorkspacePage.module.css
      hooks/
        useSidebarResize.ts            # page-specific layout resize/persistence
      components/
        WorkspaceShell.tsx             # canvas/sidebar composition
        SidebarResizer.tsx
    chat/
      ChatPage.tsx
      ChatPage.module.css
      hooks/
        useChatPage.ts                 # page-level chat behavior only
      components/
        ChatHeader.tsx
        MessageList.tsx
        MessageItem.tsx
        ChatComposer.tsx               # complete floating input section
        ThinkingLevelSelect.tsx
        hooks/
          useChatComposer.ts           # prompt, autosize, submit, keyboard handling
    settings/
      SettingsPage.tsx
      SettingsPage.module.css
      hooks/
        useSettingsPage.ts             # page-level settings/modal visibility
      components/
        SettingsHeader.tsx
        ProviderConfigurationCard.tsx
        ReviewTimingCard.tsx
        HistorySettingsCard.tsx
        SettingsFooter.tsx
        provider-config/
          ModelCombobox.tsx
          TemperatureField.tsx
          SaveProviderButton.tsx
          OllamaConfigurationFields.tsx
          OpenAICompatibleConfigurationFields.tsx
          hooks/
            useProviderConfigurationCard.ts
        modals/
          LicenseModal.tsx
          OpenSourceAttributionsModal.tsx
          UsageLogsModal.tsx
          OllamaSetupModal.tsx
          hooks/
            useCopyToClipboard.ts
            useOllamaOriginInstructions.ts
  components/
    diagram/
      DiagramCanvas.tsx
      DiagramCanvas.module.css
    ui/
      AppTooltip.tsx
      CustomSelect.tsx
      TooltipIconAction.tsx
      CopyableCommand.tsx
      icons.tsx
```

App/router/provider boundaries:
- `App.tsx` should be extremely light. It should not create settings/messages/review state itself and should not pass workspace props. It should only render the router wrapped in `AppProviders`.
- Add React Router (`react-router-dom`) as the well-known routing library. Because this is a Vite/Tauri app, prefer `HashRouter` unless browser history is confirmed to work in packaged Tauri builds.
- `src/app/router.tsx` should define the route tree. `WorkspacePage` is the main route/layout. The right-hand assistant sidebar should contain nested routes for `chat` and `settings`, e.g. `/chat` and `/settings` (or hash equivalents), so chat and settings are real routed pages rather than boolean branches in one component.
- Put all contexts and providers under `src/providers/`. `AppProviders` only composes provider components; each individual provider owns its state through its own hooks. Every value exposed through context should be produced by a provider/hook, not by `App.tsx`.
- `WorkspaceContext` should expose the shared app state/actions needed by `WorkspacePage`, `ChatPage`, and `SettingsPage`: settings, messages, status, busy state, validation error, diagram snapshot handlers, review/chat actions, settings updates, clear chat, and test connection.
- `WorkspacePage` composes the independent canvas and assistant-side routed outlet. `ChatPage` and `SettingsPage` should not receive a long prop chain from `App.tsx`; they read shared values/actions from context and keep only local UI state in page/component hooks.
- Component-specific business logic should live in a `hooks/` folder inside that component folder. Page-specific business logic should live in that page's own `hooks/` folder. Cross-page app orchestration stays under the owning provider folder, such as `src/providers/workspace/hooks/`.

Styling approach:
- Move the large global `src/styles.css` into page/component-specific styles as part of each extraction, preferably CSS Modules (`*.module.css`) because Vite supports them without adding dependencies.
- Keep only true globals in `src/styles.css`: CSS variables, body reset, theme tokens, and any shared base styles.
- Continue using existing Radix tooltip through `AppTooltip`. Do not add a new styling/component library for this refactor beyond the router requirement. If `react-router-dom` is added, update open-source attributions in the same change per `AGENTS.md`; if later Radix primitives are added, update attributions too.

The recommended sequence is context first, then page boundaries, then smaller components/hooks/styles, so each step can be build-verified and behavior-preserving.

## Files to modify

Primary existing files:
- `src/App.tsx` — reduce to an extremely light component that renders `AppProviders` and the app router only.
- `package.json` / `package-lock.json` — add React Router (`react-router-dom`) for routed chat/settings pages.
- `src/components/AssistantPanel.tsx` — remove after splitting into routed `ChatPage`, routed `SettingsPage`, popups/modals, cards, and shared UI components.
- `src/components/DiagramCanvas.tsx` — move or re-export from `src/components/diagram/DiagramCanvas.tsx`.
- `src/components/MarkdownMessage.tsx` — keep component, optionally move parsing helpers to a nearby helper only if needed later.
- `src/styles.css` — shrink to globals/theme tokens while component/page styling moves into nearby `*.module.css` files.

New files/folders to add:
- `src/app/router.tsx`
- `src/providers/AppProviders.tsx`
- `src/providers/workspace/WorkspaceProvider.tsx`
- `src/providers/workspace/WorkspaceContext.tsx`
- `src/providers/workspace/hooks/*`
- `src/providers/ui/*` if sidebar/page UI state needs to be shared
- `src/pages/workspace/*`
- `src/pages/chat/*`
- `src/pages/settings/*`
- `src/components/diagram/*`
- `src/components/ui/*`

Files explicitly out of scope:
- Any `src/**/*.story.*` / Storybook files. None were found in the current `src` scan.
- `src-tauri/*`, docs outside this plan, and provider internals unless an import path move requires a small update.
- No dependency changes except the planned router addition; if `react-router-dom` is added, update open-source attributions at the same time.

## Reuse

Existing code to keep and reuse:
- Shared tooltip primitives: `src/components/AppTooltip.tsx`, `src/components/TooltipIconAction.tsx`
- Select abstraction and hook: `src/components/CustomSelect.tsx`, `src/hooks/useCustomSelect.ts`
- Existing settings/model hooks: `src/hooks/useProviderSettings.ts`, `src/hooks/useModelSelection.ts`, `src/hooks/useReviewTimingSettings.ts`, `src/hooks/useMaskedApiKeyInput.ts` (reuse first, then move closer to the page/card/component that owns the business logic if the import graph remains clean)
- LLM review context hook: `src/hooks/useLlmReviewContext.ts` (likely becomes a workspace provider hook because it supports cross-page review orchestration)
- Service/factory style already matching `AGENTS.md`: `src/lib/llm/provider.ts`, `src/lib/storage.ts`, provider classes under `src/lib/llm/`
- Diagram helpers: `src/lib/diagramSummary.ts`, `src/lib/diagramImage.ts`
- Existing markdown renderer: `src/components/MarkdownMessage.tsx`

Important constraints found during audit:
- `App.tsx` intentionally stores high-frequency Excalidraw changes in refs instead of React state to avoid maximum-update-depth loops. The ref-based pattern must be preserved when extracting `useDiagramSnapshot`.
- Proactive review scheduling depends on `meaningfulSceneSignature`, `firstUnsentChangeAtRef`, `lastSentSignatureRef`, `lastReviewSignatureRef`, busy state, and normalized timing settings. This should move together into `useAgentReview` rather than being split across UI components.
- `AssistantPanel.tsx` contains constants/data (`THINKING_OPTIONS`, `OPEN_SOURCE_CREDITS`, `RECOMMENDED_VISION_MODELS`, Ollama OS options) that can be moved next to the components that render them.
- The local `useOllamaOriginInstructions` hook currently lives inside `AssistantPanel.tsx`; move it under `src/pages/settings/components/modals/hooks/useOllamaOriginInstructions.ts` so `OllamaSetupModal` is mostly markup.
- `AssistantPanel.tsx` currently acts like two pages in one file: chat and settings. The refactor should make those separate `ChatPage` and `SettingsPage` components while sharing app state through `WorkspaceContext` instead of prop drilling.

## Steps

- [ ] Add React Router (`react-router-dom`) and update in-app open-source attributions for the new dependency.
- [ ] Create `WorkspaceContext`, `WorkspaceProvider`, and `AppProviders` under `src/providers/`; move shared workspace state/actions behind provider-owned hooks consumed by canvas, chat, and settings areas.
- [ ] Create `src/app/router.tsx` with `HashRouter` and route definitions for the workspace layout plus nested right-sidebar routes for chat and settings.
- [ ] Create `WorkspacePage` and move current `App.tsx` body into provider/page hooks/components, leaving `App.tsx` as only the provider/router entry component.
- [ ] Extract `WorkspaceShell` and `SidebarResizer` from `WorkspacePage`; move sidebar width clamp/load/resize event logic into `src/pages/workspace/hooks/useSidebarResize.ts`.
- [ ] Extract diagram snapshot persistence into `src/providers/workspace/hooks/useDiagramSnapshot.ts`, preserving refs, debounced `appStorage.saveScene`, initial snapshot loading, and cleanup behavior.
- [ ] Extract agent/review orchestration into `src/providers/workspace/hooks/useAgentReview.ts`, including message append/token helpers, manual/chat/proactive modes, validation error checks, analytics, abort cleanup, LLM streaming, and status updates.
- [ ] Move `DiagramCanvas` into `components/diagram/` and update imports; keep the existing Excalidraw memoization and `persistenceAppState` behavior.
- [ ] Replace `AssistantPanel.tsx` with a right-sidebar routed outlet; navigation between `ChatPage` and `SettingsPage` should use router links/navigation, and both pages should read shared state/actions from `WorkspaceContext` instead of long prop chains.
- [ ] Build `ChatPage` from `ChatHeader`, `MessageList`, `MessageItem`, and `ChatComposer`; move composer-specific logic into `src/pages/chat/components/hooks/useChatComposer.ts`.
- [ ] Build `SettingsPage` from `SettingsHeader`, `ProviderConfigurationCard`, `ReviewTimingCard`, `HistorySettingsCard`, and `SettingsFooter`; put page-only modal/view state in `src/pages/settings/hooks/useSettingsPage.ts`.
- [ ] Split provider configuration into reusable and provider-specific pieces: `ModelCombobox`, `TemperatureField`, `SaveProviderButton`, `OllamaConfigurationFields`, and `OpenAICompatibleConfigurationFields`, reusing the existing provider/model/masked-key hooks.
- [ ] Split popup/modal UI into `LicenseModal`, `OpenSourceAttributionsModal`, `UsageLogsModal`, and `OllamaSetupModal`; extract component-specific logic into each modal folder's `hooks/` directory.
- [ ] Move inline SVG icon rendering to shared `components/ui/icons.tsx` because chat, settings, and modals all need icons.
- [ ] Move styles incrementally into page/component CSS Modules (`WorkspacePage.module.css`, `ChatPage.module.css`, `SettingsPage.module.css`, `DiagramCanvas.module.css`) while keeping global theme variables/reset in `src/styles.css`.
- [ ] After each phase, run the build and manually verify the corresponding UI before proceeding to the next phase.

## Verification

Automated/static checks:
- Run `npm run build` after each phase.
- Confirm TypeScript import paths compile after file moves.
- Confirm `react-router-dom` is installed, imported through the app router, and listed in open-source attributions.
- Confirm CSS Module imports compile and `src/styles.css` only carries global/theme rules.

Manual runtime checks with `npm run dev`:
- App loads with the same two-pane canvas/sidebar layout through `WorkspaceContext`/providers.
- Excalidraw renders, restores the saved scene, and continues saving diagram changes without render loops.
- Sidebar resize works with pointer dragging, ArrowLeft/ArrowRight, Home, End, persistence, and window resize clamping.
- Chat page shows empty state, message list, markdown content, thinking disclosure, clear-chat button, thinking-level select, prompt entry, Cmd/Ctrl+Enter send, manual review, and proactive/manual toggle.
- Chat and Settings are separate routed page components with their own header components; switching routes from chat to settings and back preserves shared context state.
- Provider configuration opens when untested, provider select works, endpoint/API key/model/temperature fields update settings, model dropdown loads/filter/selects models, validation error display remains intact, and Save/test connection behavior is unchanged.
- Proactive review timing settings draft/save/reset behavior is unchanged.
- Provider-specific cards/fields render correctly for Ollama and OpenAI-compatible providers.
- Ollama setup modal opens from Ollama settings, OS tabs work, copy buttons show copied state, and Escape/backdrop/close dismiss modals.
- Usage logs modal toggles consent, License modal opens/closes if linked from UI, and Open Source Attributions modal lists attributions.
- Manual, chat, and proactive review requests still stream assistant tokens and update status/analytics as before.
