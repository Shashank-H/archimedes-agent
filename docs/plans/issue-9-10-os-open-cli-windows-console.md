# Plan for GitHub Issues #9 and #10

## Context

- Issue #9 asks for native OS entry points: file/folder “Open with Archimedes”, CLI path launching, single-instance handoff, and platform notes for Windows, Linux, and iOS/mobile.
- Issue #10 asks for packaged Windows launches to avoid showing a console window and to document expected dev-vs-packaged behavior.
- Current Tauri setup is minimal: `src-tauri/src/lib.rs` registers workspace commands and `tauri-plugin-opener`; `src-tauri/src/main.rs` just calls the library `run()`; `src-tauri/tauri.conf.json` has no file association or CLI metadata yet.
- Current workspace opening supports only user-selected folders or explicit folder paths via `open_workspace_root_at`; it does not yet have a native “open this file/folder path and select/open the file” workflow.

## Approach

Add a shared native path-open pipeline in Rust and React, then route startup args, second-instance args, OS file-open events, and folder context-menu launches through that pipeline. Use the same bundled Tauri application executable for CLI launching rather than creating a separate CLI implementation; if a friendlier `archimedes` command is needed, expose it as an installer/shell alias or executable name that invokes the bundled app. Fix the Windows console issue in the Rust entrypoint and document what can and cannot be verified from this environment.

## Files to modify

Likely files:

- `src-tauri/Cargo.toml`
- `src-tauri/src/main.rs`
- `src-tauri/src/lib.rs`
- `src-tauri/src/workspace/mod.rs`
- `src-tauri/src/workspace/path.rs`
- `src-tauri/tauri.conf.json`
- `src-tauri/capabilities/default.json`
- `src/lib/workspace/native.ts`
- `src/providers/workspace/hooks/useWorkspaceTree.ts`
- `src/providers/workspace/WorkspaceProvider.tsx`
- Documentation under `docs/` and/or `docs/plans/`

## Reuse

- Reuse `workspace::open_workspace_root_from_path` semantics in `src-tauri/src/workspace/mod.rs` for folder roots.
- Reuse `create_root`, `list_children`, and `WorkspaceEntryDto` from `src-tauri/src/workspace/provider.rs` to return the opened root and identify/select a target file.
- Reuse `NativeWorkspaceProvider.openRootAt` in `src/lib/workspace/native.ts` but extend it or add a sibling method for file paths.
- Reuse `useWorkspaceTree.applyRootResult` behavior to hydrate the sidebar after a native open request.
- Reuse `openEntryAsTab` and existing supported-file detection (`isSupportedDiagramPath`) to open a requested `.excalidraw` / `.excalidraw.json` file in a tab after the root is loaded.

## Steps

- [x] Confirm exact native events/plugins needed for Tauri v2 file associations, CLI args, folder context-menu integration, and single-instance handoff.
- [x] Add the Windows GUI subsystem attribute to the Rust desktop entrypoint for non-debug builds to address #10.
- [x] Add bundle file association metadata for `.excalidraw` and `.excalidraw.json`, including Linux MIME type details where Tauri supports them.
- [x] Add “Open with Archimedes” folder support. On Windows this likely means installer/registry shell context-menu integration for directories, because file associations alone target file extensions; on Linux prefer `.desktop`/MIME support for directories if supported, otherwise document the distro-specific limitation.
- [x] Add single-instance handling so subsequent file/folder/CLI launches are forwarded to the already-running app.
- [x] Add a native command/event payload for “open this path” that distinguishes folders, supported files, invalid paths, and unsupported files.
- [x] Extend the React workspace provider/tree flow so native open requests load the correct root and open/select the target file when applicable.
- [x] Add clear user-facing errors for invalid/unsupported paths.
- [x] Update docs with CLI examples, Windows packaged-vs-dev console expectations, Linux/iOS limitations, and Windows build verification steps.
- [x] Keep mobile/iOS as documented feasibility unless Tauri support is already present and low-risk to add in the same change.

## Verification

- Run `npm run build`.
- Run Rust/Tauri checks where platform dependencies are available, e.g. `cargo check` from `src-tauri`.
- On Windows/native CI or machine: build packaged app and verify no terminal window appears for the installed app.
- On Windows: verify double-click / Open With for `.excalidraw` and `.excalidraw.json`, plus second-instance handoff.
- Verify CLI behavior for `archimedes` with no args, `archimedes .`, `archimedes <folder>`, and `archimedes <file with spaces>`.
- Verify `archimedes` with no args opens an empty Archimedes window, not the current working directory.
- Verify Windows Explorer offers “Open with Archimedes” for supported diagram files and folders.
- Verify invalid paths produce clear errors.
