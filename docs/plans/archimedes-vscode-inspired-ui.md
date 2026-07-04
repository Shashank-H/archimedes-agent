# Plan: VS Code-inspired Archimedes workspace shell

## Context

The requested change is to make Archimedes feel more like a focused workspace application instead of only a canvas plus assistant panel. The user provided `image.png` as a VS Code reference: a left activity/sidebar area with a folder/file explorer, an editor top area that communicates the active work, and a bottom status bar.

Archimedes should **not** copy VS Code wholesale. The app is a local-first architecture diagramming and AI review tool, so the UI should keep only the shell patterns that help with diagrams, workspaces, saves, assistant state, and platform-specific file actions.

Current relevant implementation:

- `src/pages/workspace/components/WorkspaceShell.tsx` already owns the main shell layout: left explorer, center Excalidraw canvas/tabs, right assistant panel.
- `src/pages/workspace/components/WorkspaceExplorer.tsx` and `WorkspaceTree.tsx` already list workspace folders/files.
- `src/pages/workspace/components/WorkspaceTabs.tsx` already renders open diagram tabs and dirty/save indicators.
- `src/pages/workspace/components/WorkspaceToolbar.tsx` exists but is currently not mounted in `WorkspaceShell`; it can be reused or reshaped for the requested top bar.
- No dedicated bottom status bar exists yet.
- Workspace providers already distinguish browser, native, and untitled workspaces through `src/lib/workspace/*`.

## Design intent

Create a VS Code-inspired shell with Archimedes-specific content:

- Keep the **left-side workspace explorer** for folders, `.excalidraw` files, unsupported files, local drafts, and recent diagrams.
- Add a **top bar** that answers: “What am I working on right now?”
- Keep/add a **bottom status bar** that answers: “What is the app doing right now?”
- Preserve the **center canvas** as the primary workspace.
- Preserve the **right assistant panel** as Archimedes’ key differentiator.
- Support different **web vs native** action sets without duplicating the whole UI.

## Markdown visualization

### Recommended desktop/native layout

```txt
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ◈ Archimedes   Workspace: payments-system   › diagrams › checkout-flow.excalidraw        Reviewing…   ⚙  │
├──────┬──────────────────────────────┬───────────────────────────────────────────────┬───────────────────────┤
│      │ EXPLORER: PAYMENTS-SYSTEM    │ checkout-flow.excalidraw  ●   auth.excalidraw │ Archimedes Agent      │
│  📁  │ ┌ actions ────────────────┐  ├───────────────────────────────────────────────┤ Ready to review       │
│      │ │ + Diagram  + Folder  ↻  │  │                                               │                       │
│  ◇   │ └─────────────────────────┘  │                                               │  chat / review stream │
│      │ WORKSPACE                    │                                               │                       │
│  ✨  │ ▾ diagrams                    │              Excalidraw canvas               │                       │
│      │   ◇ checkout-flow.excalidraw ●│                                               │                       │
│  ⚙   │   ◇ auth.excalidraw          │                                               │                       │
│      │ ▸ notes                       │                                               │                       │
│      │                               │                                               │                       │
│      │ LOCAL DRAFTS                  │                                               │                       │
│      │   ◇ Untitled diagram          │                                               │                       │
│      │                               │                                               │                       │
│      │ RECENT                        │                                               │                       │
│      │   ◇ infra-review.excalidraw   │                                               │                       │
├──────┴──────────────────────────────┴───────────────────────────────────────────────┴───────────────────────┤
│ native  payments-system  checkout-flow.excalidraw  Unsaved changes  42 elements  Ollama: gemma4:e4b  Auto ✓ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended web layout

```txt
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│  ◈ Archimedes   Browser workspace: payments-system › checkout-flow.excalidraw   Editing      │
├──────┬──────────────────────────────┬───────────────────────────────────────────────┬─────────┤
│  📁  │ EXPLORER                     │ checkout-flow.excalidraw                      │ Agent   │
│  ✨  │ Open folder  Refresh          ├───────────────────────────────────────────────┤ panel   │
│  ⚙   │ Browser folder access enabled │              Excalidraw canvas               │         │
│      │ ▾ diagrams                    │                                               │         │
│      │   ◇ checkout-flow.excalidraw  │                                               │         │
├──────┴──────────────────────────────┴───────────────────────────────────────────────┴─────────┤
│ web  File System Access API  Saved  42 elements  OpenAI-compatible/Ollama status  Ctrl+S saves │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Mobile/narrow layout

```txt
┌──────────────────────────────────────┐
│ ◈ Archimedes  checkout-flow  ⋯       │
├──────────────────────────────────────┤
│ Tabs / active status                 │
├──────────────────────────────────────┤
│ Excalidraw canvas                    │
├──────────────────────────────────────┤
│ Assistant panel                      │
├──────────────────────────────────────┤
│ Saved · 42 elements · Ollama ready   │
└──────────────────────────────────────┘
```

On narrow screens, the full explorer should collapse behind a button/sheet rather than permanently consuming width.

## What to keep from VS Code

- Left-side activity rail + explorer hierarchy.
- Compact explorer header with root name and small action buttons.
- File tree with selected/open/dirty states.
- Editor tabs.
- Top bar for current workspace/document/activity.
- Bottom status bar for persistent operational status.
- Keyboard-friendly compact controls.

## What not to copy from VS Code

Avoid adding VS Code features that do not serve Archimedes right now:

- Source control panel.
- Debug/run panel.
- Extensions marketplace.
- Problems/output/debug console/terminal tabs.
- Full menu bar clone.
- Language mode indicators.
- Git branch/status unless a future diagram-workspace feature needs it.

## Approach

### 1. Refactor the shell into named regions

Update `WorkspaceShell` from a simple flex row into a grid-like app shell:

```txt
app-shell
  workspace-top-bar
  app-main
    workspace-activity-rail
    workspace-sidebar
    canvas-pane
      workspace-tabs
      workspace-editor-body
    assistant-panel
  workspace-status-bar
```

The shell should still use the existing providers and tab manager, but the layout should make room for top and bottom bars.

### 2. Add an Archimedes activity rail

Create a slim left rail inspired by VS Code, but keep only Archimedes-specific icons:

- **Explorer**: shows workspace files and diagrams.
- **Drafts/Diagrams**: optional future section for local drafts/recent diagrams.
- **Assistant**: toggles/focuses the right assistant panel.
- **Settings**: opens the existing settings view in the right panel.

Initial implementation can keep Explorer selected by default and avoid building a full multi-view sidebar if that is too much for one pass. The key is to establish the visual rail and extension point.

### 3. Upgrade the workspace explorer

Keep `WorkspaceExplorer` and `WorkspaceTree`, but restyle and reorganize them:

- Header label: `EXPLORER: <ROOT NAME>`.
- Small icon buttons for supported actions instead of large text buttons.
- Workspace file tree section.
- Local drafts section.
- Recent diagrams section, if recent data is available or can be derived from existing tabs/local drafts.
- Dim unsupported files but keep them visible.
- Show dirty dot and open indicator consistently.
- Keep folder expansion lazy; do not recursively load everything.

### 4. Add a top bar for current activity

Introduce `WorkspaceTopBar` or repurpose `WorkspaceToolbar`.

Recommended content:

- Left: Archimedes mark/name and current workspace root.
- Middle: breadcrumb for active file path.
- Activity text:
  - `Editing <file>`
  - `Unsaved changes in <file>`
  - `Saving <file>…`
  - `Reviewing diagram…`
  - `No document open`
- Right: compact actions:
  - Open folder.
  - New diagram/local draft.
  - Save.
  - Review diagram.
  - Settings.

The top bar should not become a full VS Code menu clone. It should be an Archimedes work summary and quick-action surface.

### 5. Add a bottom status bar

Create `WorkspaceStatusBar`.

Recommended status segments:

Left side:

- Runtime: `web` or `native`.
- Workspace provider: `browser`, `native`, or `local draft`.
- Current root name.
- Active file name/path.
- Save state: `Saved`, `Unsaved`, `Saving`, `Save failed`.

Middle/right side:

- Diagram metadata: element count if available from active snapshot.
- Assistant status from `useChat()`.
- Active provider/model: `Ollama · gemma4:e4b` or OpenAI-compatible provider.
- Auto-review state: `Auto review on/off`.
- Shortcut hint: `Ctrl+S save`.

The status bar should remain visible across web and native.

### 6. Split web and native action sets through capability descriptors

Do not fork the UI. Use a small runtime/capability layer to decide which actions are visible.

Web should emphasize:

- Open browser folder.
- File System Access API support/permission state.
- Save through browser handle when available.
- Local drafts fallback.
- Clear messaging when folder access is unsupported.

Native should be allowed to add extra options over time:

- Open folder through native dialog.
- Recent workspaces.
- New folder.
- Rename diagram.
- Reveal in Finder/Explorer/file manager.
- Copy absolute path.
- File watching/refresh status when implemented.
- Native title-bar drag/window integration if desired.

Initial implementation can include only actions already backed by current APIs, while reserving menu slots for native-only actions.

### 7. Preserve the right assistant panel

The assistant panel should stay on the right and continue using:

- `AssistantPaneRouter`
- `AssistantHeader`
- `ChatPage`
- `SettingsPage`

The new shell should surface assistant state in the top/status bars, but should not move the whole assistant into the left rail.

### 8. Improve visual styling without fighting Excalidraw

Use the existing design tokens in `src/styles.css` and `DESIGN.md`:

- Hairline borders.
- Compact row heights.
- Geist/Geist Mono typography.
- Dark/light theme support.
- Subtle active states.
- Avoid heavy shadows around the canvas.

The left/sidebar should look closer to the provided VS Code reference in structure, but use Archimedes colors and spacing.

## Files to modify

Primary files:

- `src/pages/workspace/components/WorkspaceShell.tsx`
- `src/pages/workspace/components/WorkspaceExplorer.tsx`
- `src/pages/workspace/components/WorkspaceTree.tsx`
- `src/pages/workspace/components/WorkspaceTabs.tsx`
- `src/pages/workspace/components/WorkspaceToolbar.tsx`
- `src/styles.css`

Likely new files:

- `src/pages/workspace/components/WorkspaceTopBar.tsx`
- `src/pages/workspace/components/WorkspaceStatusBar.tsx`
- `src/pages/workspace/components/WorkspaceActivityRail.tsx`
- `src/pages/workspace/components/WorkspacePlatformActions.tsx` or similar action descriptor helper

Possible supporting changes:

- `src/providers/workspace/WorkspaceContext.tsx` to expose derived runtime/provider data if components need it.
- `src/providers/workspace/tabs/WorkspaceTabManagerContext.tsx` only if status/top bar need additional tab metadata not currently exposed.
- `src/lib/workspace/types.ts` only if provider capabilities need more action metadata.
- `src/components/ui/icons.tsx` to add file/folder/status icons from Radix or lightweight inline icons.

## Reuse

Reuse existing code rather than rebuilding workspace behavior:

- `WorkspaceExplorer` for root/open/refresh and tree ownership.
- `WorkspaceTree` for recursive folder/file rendering.
- `WorkspaceTabs` for open document tabs and dirty/save indicators.
- `WorkspaceToolbar` status/save logic as the basis for `WorkspaceTopBar`.
- `useWorkspace()` for root, settings, tree data, selected entry, and open/refresh actions.
- `useWorkspaceTabManager()` for active tab, active snapshot, tabs, save, close, switch, and local drafts.
- `useChat()` for assistant busy/status text.
- `workspaceProviderFactory` and `WorkspaceCapabilities` for web/native/provider-aware actions.
- `CustomHorizontalScrollbar` for tab overflow.
- `AppTooltip` for compact icon controls.
- `Icon` from `src/components/ui/icons.tsx`, extending it only where necessary.
- Existing CSS variables and dark/light theme classes.

## Web vs native behavior plan

| Area | Web | Native |
| --- | --- | --- |
| Folder open | Browser File System Access API when supported | Tauri native folder dialog, existing fallback path prompt |
| Explorer actions | Open, refresh, new local draft, new diagram if provider supports create | Open, refresh, new diagram, future new folder/rename/reveal/copy path |
| Top bar | Browser workspace label and permission hint | Native workspace label, optional title-bar drag/window-safe areas |
| Bottom status | `web`, provider, save state, model, auto-review | `native`, provider, absolute path/root, save state, model, auto-review |
| Unsupported capabilities | Show clear disabled/hidden state | Show native-only options only when backed by commands |
| File watching | Not expected initially | Future status slot: `Watching` / `Manual refresh` |

## Implementation steps

- [ ] Create `WorkspaceTopBar` that receives/reads active tab, root, save state, chat status, settings, and key workspace actions.
- [ ] Create `WorkspaceStatusBar` with runtime, provider, root/file, save state, element count, assistant status, model, auto-review, and shortcut hints.
- [ ] Create `WorkspaceActivityRail` with a minimal Archimedes-specific icon set and no irrelevant VS Code panels.
- [ ] Refactor `WorkspaceShell` to render top bar, main content regions, and bottom status bar while preserving current canvas/assistant behavior.
- [ ] Restyle `WorkspaceExplorer` header into a VS Code-like explorer header with compact action icons.
- [ ] Enhance `WorkspaceTree` row visuals: folder/file icons, selected/open/dirty/error/unsupported states, denser row spacing.
- [ ] Decide how local drafts and recent diagrams are surfaced in the sidebar using existing local draft/tab data first.
- [ ] Add capability-driven platform action descriptors so web and native can expose different options cleanly.
- [ ] Update `styles.css` for the shell grid, top bar, activity rail, explorer, status bar, dark theme, and responsive behavior.
- [ ] Verify the top/status bars update for loading, dirty, saved, save error, unsupported file, and assistant busy states.
- [ ] Add or update accessibility labels for icon-only controls and status regions.

## Verification

Run/build checks:

- [ ] `npm run build`
- [ ] Browser dev mode at `http://localhost:1420`
- [ ] Tauri dev mode if local native dependencies are available: `npm run tauri dev`

Manual UI checks:

- [ ] Compare against `image.png`: left rail/sidebar, top work summary, tabs, and bottom status bar should feel similar in structure.
- [ ] Confirm the UI does not include irrelevant VS Code features such as terminal, source control, debugger, or extensions.
- [ ] Open a workspace folder and expand/collapse directories.
- [ ] Open supported `.excalidraw` / `.excalidraw.json` files.
- [ ] Select an unsupported file and verify placeholder/error UI remains clear.
- [ ] Create/open a local draft.
- [ ] Make diagram changes and confirm dirty indicators appear in sidebar, tabs, top bar, and status bar.
- [ ] Save with `Ctrl+S` and with UI controls; confirm status changes to saving/saved/error as appropriate.
- [ ] Trigger manual review and confirm top/status bars show assistant activity.
- [ ] Toggle settings/chat in the right assistant panel and confirm the shell remains stable.
- [ ] Test dark and light themes.
- [ ] Test narrow viewport behavior; explorer should collapse or stack without breaking canvas/assistant.
- [ ] In web mode, verify unsupported File System Access API messaging if applicable.
- [ ] In native mode, verify only backed native options are shown/enabled.

## Risks and mitigations

- **Risk:** The UI becomes too much like an IDE and distracts from diagramming.  
  **Mitigation:** Keep only Explorer, current activity, assistant status, save state, and platform file actions.

- **Risk:** Native/web differences create duplicated components.  
  **Mitigation:** Use capability/action descriptors and shared shell components.

- **Risk:** Top/status bars duplicate information from tabs and assistant header.  
  **Mitigation:** Top bar summarizes current task; status bar summarizes operational state; tabs remain document switching.

- **Risk:** Additional shell height reduces canvas space.  
  **Mitigation:** Keep bars compact: top around 36-44px, status around 22-26px, tabs around current 32px.

- **Risk:** Icon-only controls hurt accessibility.  
  **Mitigation:** Use `aria-label`, tooltips, visible focus states, and keyboard support.

## Recommended first implementation scope

For the first implementation pass, build:

1. Top bar.
2. Bottom status bar.
3. Activity rail.
4. Restyled explorer/tree.
5. Web/native action filtering for currently supported actions only.

Defer until a later pass:

- Rename/delete files.
- New folders.
- Reveal in system file manager.
- File watcher status.
- Full command palette.
- Persistent recent workspace list.
