# Plan: Issue #23 Settings outside the assistant pane

## Context

GitHub issue #23 asks to move Settings out of the assistant/chat routed context so settings feel like global **App Settings**, not chat/model-only configuration.

Current implementation findings:

- `src/app/constants.ts` defines `settings` as an assistant pane view.
- `src/app/router.tsx` renders `SettingsPage` inside the assistant pane and listens for `archimedes:open-settings` by switching the assistant route.
- `src/pages/settings/SettingsPage.tsx` already owns the settings UI and uses `useWorkspace()` for persisted `settings` / `handleSettingsChange`.
- `src/pages/workspace/components/WorkspaceShell.tsx` currently expands the assistant panel before dispatching `archimedes:open-settings`.
- `src/pages/workspace/components/WorkspaceTopBar.tsx` and `src/pages/workspace/components/WorkspaceActivityRail.tsx` are the visible settings entry points.
- `src/providers/workspace/tabs/WorkspaceTabManagerContext.tsx`, `src/pages/workspace/components/WorkspaceTabs.tsx`, and `src/pages/workspace/components/WorkspaceShell.tsx` already provide a VS Code-style center editor tab surface.

## Recommended approach

Prefer a VS Code-style **App Settings editor tab** instead of nested dialogs or an assistant-pane route.

Rationale:

- It keeps settings clearly app-level and outside chat.
- It avoids nested-dialog complexity entirely.
- It matches the existing workspace mental model: explorer, editor tabs, assistant pane.
- It lets users keep chat visible while working through settings.
- It gives settings more room than a side panel without blocking the whole app like a modal.

Product behavior:

- Clicking Settings opens or focuses a single pinned/special `App Settings` tab in the center editor area.
- The assistant pane remains unchanged: if chat is open, it stays open; if collapsed, it stays collapsed.
- The Settings tab is not a diagram file and should not be saved, marked dirty, or included in workspace file persistence.
- The existing `archimedes:open-settings` event should focus/open this settings tab for compatibility.
- The settings content should be refactored to feel like global app settings and use internal section navigation/sidenav rather than nested dialogs.

## Files to modify

Critical files:

- `src/app/constants.ts`
- `src/app/router.tsx`
- `src/app/hooks/useAssistantPaneNavigation.ts`
- `src/lib/workspace/types.ts`
- `src/providers/workspace/tabs/WorkspaceTabManagerContext.tsx`
- `src/pages/workspace/components/WorkspaceShell.tsx`
- `src/pages/workspace/components/WorkspaceTabs.tsx`
- `src/pages/workspace/components/WorkspaceTopBar.tsx`
- `src/pages/workspace/components/WorkspaceActivityRail.tsx`
- `src/pages/settings/SettingsPage.tsx`
- `src/pages/settings/SettingsPage.module.css`

Possible new files:

- `src/pages/settings/SettingsEditorTab.tsx`
- `src/pages/settings/settingsSections.ts`

## Reuse

Existing code to reuse:

- `SettingsPage` from `src/pages/settings/SettingsPage.tsx` for the existing settings controls and persistence wiring.
- `SettingsAccordion` from `src/pages/settings/components/SettingsAccordion.tsx` if accordion sections remain useful.
- `useWorkspace()` from `src/providers/workspace/WorkspaceContext.tsx` for `settings` and `handleSettingsChange`.
- `WorkspaceTabs` from `src/pages/workspace/components/WorkspaceTabs.tsx` for the tab-strip UI.
- `WorkspaceTabManagerContext` from `src/providers/workspace/tabs/WorkspaceTabManagerContext.tsx` for active-tab state and tab actions.
- Existing icons via `src/components/ui/icons.tsx`.

## Steps

- [ ] Confirm whether issue #23 should be implemented as a VS Code-style settings editor tab instead of the originally requested modal/pop-up.
- [ ] Remove settings from assistant-pane routing: `ASSISTANT_PANE_VIEW_IDS`, `ASSISTANT_PANE_VIEWS`, and `ASSISTANT_PANE_COMPONENT_BY_VIEW` should only handle chat.
- [ ] Stop `AssistantPaneRouter` from handling `archimedes:open-settings`; keep only chat routing in the assistant pane.
- [ ] Add a special non-file workspace tab model for app pages, starting with `App Settings`.
- [ ] Add an `openSettingsTab`/`openAppSettingsTab` action to `WorkspaceTabManagerContext` that creates-or-focuses the singleton settings tab.
- [ ] Update `WorkspaceShell.handleOpenSettings` to call the tab action without expanding or changing the assistant pane.
- [ ] Add a window listener in the workspace shell or tab manager so `archimedes:open-settings` opens/focuses the settings tab.
- [ ] Update `WorkspaceTabs` to render the settings tab with suitable title/icon/status and without save behavior.
- [ ] Update the editor body in `WorkspaceShell` to render `SettingsEditorTab` when the active tab is the settings tab; otherwise keep current diagram/error/unsupported rendering.
- [ ] Refactor `SettingsPage` presentation for a wider editor-tab layout with a left/internal section nav and global title such as `App Settings`.
- [ ] Replace nested settings dialogs with inline/sidenav sections where practical, especially for Ollama setup, usage logs/privacy explanation, and open source attributions.
- [ ] Move repeated section labels, helper copy, and option metadata into a nearby constants file where practical.
- [ ] Update settings button labels/tooltips from assistant-specific language to app-wide language.
- [ ] Ensure settings persistence still flows through `WorkspaceProvider` and existing storage.

## Verification

Automated:

- [ ] Run the existing typecheck/build command from `package.json`.
- [ ] Run relevant tests if present.

Manual QA:

- [ ] Click Settings in the top bar: an `App Settings` editor tab opens or focuses.
- [ ] Click Settings in the activity rail: the same singleton settings tab opens or focuses.
- [ ] Dispatch `archimedes:open-settings`: the settings tab opens or focuses.
- [ ] Assistant/chat remains visible and on its current conversation when settings opens.
- [ ] If assistant is collapsed, opening settings does not expand it.
- [ ] Switching between a diagram tab and Settings preserves each view's state.
- [ ] Settings tab close behavior works and does not affect diagram tabs.
- [ ] Provider/model/theme/review settings still persist after reload.
- [ ] Copy and sectioning communicate global app settings, not assistant-pane settings.
