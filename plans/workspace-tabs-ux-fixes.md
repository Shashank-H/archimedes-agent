# Plan: Workspace tab UX fixes

## Context

Users are seeing workspace/editor UX issues around open files and save state:

- Opening a file for the first time can mark it dirty even though no user edit happened.
- The active/opened tab is not visually distinct enough, so it is hard to know which file is currently shown on the canvas.
- Save actions are available even when the active document is already saved.
- The tab strip needs a right-side options menu with workspace/tab actions such as clearing the canvas and closing all tabs.

Initial code findings:

- Tab state and dirty tracking live in `src/providers/workspace/tabs/WorkspaceTabManagerContext.tsx`.
- The Excalidraw canvas sends every `onChange` through `src/components/diagram/DiagramCanvas.tsx`; this likely includes the initial Excalidraw hydration event, which can differ slightly from the serialized file snapshot and mark the tab dirty.
- Tab rendering and per-tab save/close controls live in `src/pages/workspace/components/WorkspaceTabs.tsx`.
- The top-bar Save button enablement is controlled by `src/pages/workspace/components/WorkspaceTopBar.tsx` and `src/lib/workspace/platformActions.ts`.
- Active tab styling exists in `src/styles.css`, but later workspace panel rules flatten active/inactive colors, making the active tab too subtle.

## Approach

Recommended approach:

1. Treat the first Excalidraw `onChange` after mounting a document as initialization noise unless it represents an actual user edit after the canvas is ready.
2. Make `dirty` mean `current fingerprint !== saved fingerprint` only after the document's baseline has been established from the loaded file/local draft.
3. Change save enablement so Save is enabled only for supported, loaded documents whose `saveState` is `dirty` or `error`, and disabled for `saved`, `idle`, `loading`, and `saving`.
4. Strengthen active tab visuals with an explicit `aria-selected`/`.is-active` style that survives later CSS overrides in light and dark themes.
5. Add a right-aligned tab strip options menu with safe, high-value actions:
   - Save active file (disabled unless dirty/error and saveable)
   - Close active tab
   - Close saved tabs
   - Close all tabs, including untitled/local draft tabs (confirm if any dirty tabs)
   - Clear current canvas: remove only items/files from the active canvas, do not affect other tabs or unrelated app/view/theme state (confirm, marks current tab dirty)
   - New untitled diagram

## Files to modify

- `src/components/diagram/DiagramCanvas.tsx`
- `src/providers/workspace/tabs/WorkspaceTabManagerContext.tsx`
- `src/pages/workspace/components/WorkspaceTabs.tsx`
- `src/pages/workspace/components/WorkspaceShell.tsx`
- `src/pages/workspace/components/WorkspaceTopBar.tsx`
- `src/lib/workspace/platformActions.ts`
- `src/styles.css`

## Reuse

- Reuse `createSnapshotFingerprint`, `resolveSnapshotSaveState`, and per-tab document records in `WorkspaceTabManagerContext.tsx` for dirty-state correctness.
- Reuse existing `saveTab`, `closeTab`, `openUntitledTab`, and confirmation patterns for menu actions.
- Reuse `AppTooltip` in `WorkspaceTabs.tsx` for tab/menu control labels.
- Reuse existing workspace action descriptor pattern in `platformActions.ts` for Save button enablement consistency.
- Reuse `ExcalidrawImperativeAPI` (`ExcalidrawApi`) through the existing `setDiagramApi` path if canvas clearing can be done via API; otherwise add a tab-manager-level `clearTab` that replaces the active snapshot with an empty snapshot.

## Steps

- [x] Add/save a tab-manager helper for saveability, so tabs/top bar/shortcut all agree that saved files cannot be saved again but errored saves can be retried.
- [x] Fix initial open dirty state by ignoring or baselining Excalidraw's first mount-time `onChange` for each `documentKey`.
- [x] Ensure loaded files start with `saveState: 'saved'` and remain saved until a real content change occurs.
- [x] Update `WorkspaceTopBar`/`platformActions` Save enablement to disable Save for already-saved files.
- [x] Update `WorkspaceTabs` to show active styling, always reserve a right-side options area, and add an accessible options menu.
- [x] Add tab-manager actions needed by the menu: close active, close saved tabs, close all tabs including untitled/local drafts with dirty confirmation, and clear only the active canvas contents with confirmation.
- [x] Update CSS for active tabs, hover/focus states, disabled Save styling, and the right-side menu in both light and dark themes.

## Verification

- Run `npm run build`.
- Manual checks:
  - Open a saved `.excalidraw` file for the first time; it should show `Saved`, no dirty dot, and Save disabled.
  - Edit the canvas; the active tab and status should become dirty and Save should enable.
  - Save; dirty state should clear and Save should disable again.
  - Switch between multiple tabs; the active tab should be visually obvious.
  - Put a tab into save `error` state if practical; Save should remain enabled so the user can retry.
  - Use the options menu to clear the current canvas; confirmation should appear, only the active canvas contents should clear, other tabs should remain unchanged, and the active tab should become dirty.
  - Use Close active / Close saved tabs / Close all with a mix of saved, dirty, and untitled draft tabs; dirty tabs should be protected by confirmation, and Close all should close every tab after confirmation.
  - Repeat active tab and menu styling checks in dark theme.
