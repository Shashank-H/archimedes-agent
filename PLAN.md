# Plan: Filesystem workspace for Excalidraw diagrams

## Goal

Add a VS Code-style workspace where users can open a folder, browse diagram files, edit them on the canvas, and save changes back to disk. The implementation should support native desktop use first, browser fallback where possible, and clean provider seams for future remote workspaces.

## Product shape

- A persistent three-pane workspace:
  - left explorer/sidebar for folders and files,
  - center multi-tab Excalidraw editor,
  - right assistant pane.
- Users can open a folder as a workspace root.
- Supported diagram files can be selected from the tree and opened as tabs.
- Multiple diagram tabs can remain open at the same time.
- Users can switch tabs without losing each document's canvas state.
- Edits mark the active tab/document as dirty.
- Users can save the active tab explicitly, with clear saving/saved/error states.
- Unsupported files remain visible but open into a non-editable placeholder.
- If no folder is open, users can still use an untitled/local diagram.

## Core architecture

### Workspace provider interface

Create a provider-neutral workspace layer with a common interface for all filesystem backends.

Providers should expose:

- open workspace root,
- list folder children,
- read file,
- write file,
- optional refresh/watch support,
- provider capabilities.

Use structured resource IDs for files and roots so the UI is not tied to a specific backend.

A resource ID is an internal identifier with two parts:

```txt
<provider-kind>://<provider-owned-path-or-handle-id>
```

The prefix tells the app which provider owns the resource. The rest of the ID is opaque to the UI and is interpreted only by that provider.

Examples:

- `native:///Users/me/diagrams/flow.excalidraw` — a desktop file accessed through Tauri.
- `browser://workspace-1/flow.excalidraw` — a browser directory handle entry.
- `untitled://local/default` — an unsaved or local fallback diagram.
- `ssh://server-a/home/me/flow.excalidraw` — a future remote file provider.
- `wsl://ubuntu/home/me/flow.excalidraw` — a future WSL provider.

The UI should store and compare these IDs, but should not parse OS paths or assume a filesystem shape. When the user selects, saves, closes, or refreshes a file, the app passes the ID back to the provider factory. The factory chooses the right provider from the prefix and the provider handles the actual read/write operation.

This keeps tabs, dirty state, tree selection, and assistant context working the same way for native files, browser handles, untitled diagrams, and future remote workspaces.

### Provider implementations

Implement providers as classes:

- `NativeWorkspaceProvider` for Tauri filesystem access.
- `BrowserWorkspaceProvider` for the File System Access API.
- `UntitledWorkspaceProvider` for local unsaved/fallback diagrams.
- `WorkspaceProviderFactory` for runtime selection.

The React UI should only depend on the shared provider interface, not on Tauri or browser APIs directly.

## Data model

Add workspace/domain types for:

- workspace root,
- tree entry,
- file ID,
- active document,
- document load state,
- dirty/save state,
- provider capabilities,
- parse/save errors.

Supported editable extensions:

- `.excalidraw`
- `.excalidraw.json`

Generic `.json` should not be treated as editable unless explicitly identified as an Excalidraw file.

## File serialization

Add Excalidraw file helpers for:

- parsing file content into a diagram snapshot,
- serializing a diagram snapshot back to file content,
- validating required shape,
- preserving elements, app state, and files,
- producing useful errors for malformed files.

## Workspace state

Workspace state should own:

- selected provider,
- current root,
- loaded tree nodes,
- expanded folders,
- selected entry,
- open tabs,
- active tab ID,
- active document,
- active diagram snapshot,
- per-tab dirty state,
- per-tab save state,
- workspace errors.

Expose actions for:

- opening a folder,
- refreshing a folder,
- expanding/collapsing folders,
- selecting a file,
- opening a file in a tab,
- switching tabs,
- closing tabs,
- creating/returning to an untitled tab,
- updating the active tab snapshot,
- saving the active tab/document.

## UI components

Add or update components for:

- workspace shell layout,
- explorer/sidebar,
- file tree rows,
- editor tab strip,
- open-folder empty state,
- active document toolbar/status,
- unsupported file placeholder,
- document load/error states.

The canvas component should receive the active tab snapshot and a stable document key so switching tabs cannot leak state between documents.

## Native filesystem support

Use Tauri for native filesystem access, but design the Tauri layer as an operating-system-extensible boundary rather than a one-off implementation for a single OS.

Native implementation requirements:

- expose OS-neutral commands to the frontend, such as `open_workspace_root`, `list_workspace_children`, `read_workspace_file`, and `write_workspace_file`,
- keep command request/response shapes independent of macOS, Windows, or Linux path conventions,
- normalize path handling through Rust path APIs instead of string concatenation,
- support platform-specific behavior behind traits or small adapter modules when needed,
- open/select a directory through the platform's native dialog,
- list direct children on demand,
- read supported files,
- write supported files,
- validate paths stay inside the opened root after canonicalization,
- avoid recursive full-tree loading by default,
- return structured errors for permissions, missing files, invalid paths, unsupported platforms, and platform-specific failures.

Suggested native structure:

```txt
src-tauri/src/workspace/
  mod.rs          # command registration and shared DTOs
  provider.rs     # OS-neutral workspace trait/service
  path.rs         # canonicalization and root-boundary checks
  platform.rs     # platform-specific adapters selected with cfg(...)
```

The first implementation can share most logic across all desktop platforms, but the module boundaries should make it straightforward to add platform-specific handling for Windows drive roots, macOS sandbox/security-scoped access, Linux portals, WSL discovery, or network-mounted filesystems later.

Update Tauri capabilities with the smallest required permissions.

## Browser filesystem support

Use the File System Access API when available.

Browser implementation requirements:

- open a directory handle,
- list children on demand,
- read files,
- write files when permission allows,
- detect unsupported browsers and show a clear message.

Do not silently pretend folder workspaces are available when the API is missing.

## Saving behavior

Use explicit save as the default behavior.

- Mark documents dirty after canvas changes.
- Show dirty state near the filename and/or tree item.
- Save writes the serialized snapshot for the active tab through the active provider.
- Show saving, saved, and error states.
- Prevent saving unsupported files.
- Handle deleted or moved files with a recoverable error.

Autosave can be added later as a setting, but should not be the first behavior.

## Implementation order

1. Add workspace domain types and provider interface.
2. Add Excalidraw parse/serialize helpers.
3. Add tab model for open documents, active tab, close behavior, and per-tab dirty/save state.
4. Add untitled provider and wire local untitled tabs through the provider model.
5. Add workspace state hooks for tree, tabs, document loading, dirty state, and saving.
6. Build the three-pane shell, editor tab strip, and explorer UI with mocked/untitled data.
7. Implement OS-extensible native provider and Tauri commands/capabilities.
8. Wire native folder opening, tree expansion, file loading, tab opening, tab switching, and saving.
9. Implement browser provider with feature detection.
10. Add unsupported-file and malformed-file states.
11. Add polish: status labels, refresh, keyboard shortcut for save, close-tab prompts, empty states.
12. Document native/browser behavior, OS-specific notes, and supported file formats.

## Suggested file layout

```txt
src/lib/workspace/
  types.ts
  factory.ts
  native.ts
  browser.ts
  untitled.ts

src/lib/excalidrawFile.ts

src/providers/workspace/
  WorkspaceContext.tsx
  WorkspaceProvider.tsx
  hooks/
    useWorkspaceTree.ts
    useWorkspaceTabs.ts
    useWorkspaceDocuments.ts
    useWorkspaceSettings.ts
    useDiagramSnapshot.ts

src/pages/workspace/components/
  WorkspaceShell.tsx
  WorkspaceExplorer.tsx
  WorkspaceTree.tsx
  WorkspaceTabs.tsx
  WorkspaceToolbar.tsx
  UnsupportedFileView.tsx
```

Native additions, if using Rust commands:

```txt
src-tauri/src/workspace/
  mod.rs
  provider.rs
  path.rs
  platform.rs
src-tauri/src/lib.rs
src-tauri/capabilities/default.json
```

## Verification checklist

- [ ] App builds successfully.
- [ ] Untitled/local diagram flow works without opening a folder.
- [ ] Native app can open a folder.
- [ ] Explorer expands folders on demand.
- [ ] Supported diagram files open as editor tabs and load into the canvas.
- [ ] Switching tabs loads the correct diagram state.
- [ ] Closing a dirty tab prompts or prevents accidental data loss.
- [ ] Editing marks the active tab/document dirty.
- [ ] Save writes the active tab file successfully.
- [ ] Save errors are visible and recoverable.
- [ ] Unsupported files do not crash the editor.
- [ ] Malformed diagram files show a useful error.
- [ ] Browser mode clearly handles unsupported File System Access API.
- [ ] Assistant actions use the active diagram snapshot.
- [ ] Large folders do not require eager recursive loading.
- [ ] Native filesystem access is restricted to the opened workspace root.
- [ ] Native workspace commands work with OS-neutral request/response types.
- [ ] Path handling is validated on macOS, Windows, and Linux assumptions, including separators and root formats.
