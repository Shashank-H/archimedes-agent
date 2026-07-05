# OS Open, CLI Launching, and Windows Console Behavior

Archimedes uses the bundled Tauri desktop executable for OS integration and CLI-style launching. There is no separate CLI implementation; installer shortcuts, file associations, and shell commands all invoke the same app binary with optional path arguments.

## CLI examples

On Windows, the NSIS installer includes a checkbox to add the `archimedes` command to your user `PATH`. After installing with that option selected, open a new terminal and run:

```bash
archimedes
archimedes .
archimedes /path/to/workspace
archimedes /path/to/diagram.excalidraw
archimedes "/path/with spaces/diagram.excalidraw.json"
```

The bundled executable can also be invoked directly as `archimedes-agent.exe` from the install directory.

Behavior:

- No arguments opens an empty Archimedes window.
- A folder argument opens that folder as the workspace root.
- A supported file argument opens the file's parent folder as the workspace root and opens/selects the file.
- Supported files are `.excalidraw` and `.excalidraw.json`.
- Invalid paths and unsupported files are reported in the workspace error area.
- If Archimedes is already running and a requested file/folder belongs to an active workspace window, the existing matching window is focused and receives the file.
- If the requested file/folder is not inside any active workspace window, Archimedes opens a new isolated window for that path.
- Isolated windows use their own per-window session state for local drafts, chat, scene, and remembered workspace root, so multiple Archimedes windows do not mirror the same content.
- Launching Archimedes again with no path while it is already running creates a new empty isolated window.

## Windows packaged vs. development console behavior

Packaged non-debug Windows builds use the Windows GUI subsystem, so launching Archimedes from Explorer, file association, or a Start Menu shortcut should not show a console window.

Development builds can still show terminal output because they are launched by `npm run tauri -- dev`, Cargo, or a terminal. That is expected and useful for debugging.

## Windows Explorer integration

The packaged installer registers:

- `Open with Archimedes` for `.excalidraw` files.
- `Open with Archimedes` for `.excalidraw.json` files.
- `Open with Archimedes` for folders, folder background context menus, generic shell folders, and drives through NSIS registry hooks.
- Optional `archimedes` CLI command via an installed `archimedes.cmd` shim and user `PATH` update.
- A `New Archimedes Window` Start Menu shortcut. When Archimedes is pinned/running, launching the app from the taskbar while it is already running also opens a new empty window.

Folder support is installer/registry-based because extension file associations only apply to files. On Windows 11, classic registry shell verbs may appear under **Show more options** depending on Explorer's context-menu mode.

## Linux limitations

Tauri bundle metadata declares MIME/file association information for the supported diagram file types, which Linux packages can write into the generated `.desktop` file where supported by the package target and desktop environment.

Folder context-menu integration is less standardized on Linux. Some file managers require distro- or desktop-specific extensions/actions for directory context menus, so Archimedes documents folder launching via CLI as the portable Linux path until a specific package/file-manager integration is added.

## iOS/mobile limitations

This change keeps mobile support as documented feasibility. Tauri has mobile open/URL events, but packaged desktop file associations and folder context menus are desktop-specific and are not implemented for iOS in this change.

## Windows verification checklist

On a Windows machine or Windows CI runner:

1. Build the packaged app:

   ```powershell
   npm ci
   npm run tauri -- build
   ```

2. Install the generated NSIS installer from:

   ```txt
   src-tauri\target\release\bundle\nsis\*.exe
   ```

3. Launch from Start Menu or Explorer and verify no console window appears.
4. Double-click a `.excalidraw` file and verify Archimedes opens it.
5. Double-click a `.excalidraw.json` file and verify Archimedes opens it.
6. Right-click a folder and verify `Open with Archimedes` appears and opens that folder.
7. Right-click inside a folder background and verify `Open with Archimedes` appears and opens that folder.
8. With Archimedes already running, repeat file/folder launches for paths inside an active workspace and verify the matching window is focused.
9. Open a file/folder outside every active workspace and verify a new isolated window opens.
10. Launch Archimedes again from the taskbar/shortcut while it is already running and verify a new empty isolated window opens.
11. During install, keep `Add the archimedes command to my user PATH` checked.
12. Open a new terminal and verify `archimedes`, `archimedes .`, `archimedes <folder>`, and `archimedes <file with spaces>`.
