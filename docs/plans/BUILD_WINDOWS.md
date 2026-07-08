# Build Windows EXE

## Current environment

This checkout is running in Linux/WSL. Rust/Cargo is installed in WSL after sourcing `~/.cargo/env`, and the frontend build passes.

A Windows cross-build from WSL was attempted with:

```bash
. ~/.cargo/env
npm run tauri -- build --target x86_64-pc-windows-msvc
```

It currently fails because the WSL environment does not have the Windows resource compiler/linker toolchain available:

```txt
called `Result::unwrap()` on an `Err` value: NotAttempted("llvm-rc")
```

A native Linux Tauri build was also attempted and requires Linux WebKit/pkg-config system packages that are not installed in this WSL image.

The frontend build does pass with:

```bash
npm run build
```

## Option A: Build on a Windows machine

Install prerequisites:

1. Node.js 24+
2. Rust stable: <https://rustup.rs/>
3. Microsoft Visual Studio Build Tools with the C++ workload
4. WebView2 Runtime, normally already present on Windows 10/11

Then run from **Command Prompt** or a PowerShell session where npm scripts are allowed:

```powershell
npm ci
npm run tauri -- build
```

If PowerShell blocks npm scripts, use Command Prompt instead:

```cmd
npm ci
npm run tauri -- build
```

Expected outputs:

```txt
src-tauri\target\release\bundle\nsis\*.exe
src-tauri\target\release\bundle\msi\*.msi
```

After installing the NSIS build, verify:

1. Launching from Explorer or Start Menu does not show a console window.
2. `.excalidraw` and `.excalidraw.json` files show/open with Archimedes.
3. Folders, folder backgrounds, generic shell folders, and drives show `Open with Archimedes` (on Windows 11 this may be under **Show more options**).
4. The installer offers `Add the archimedes command to my user PATH`; when checked, a new terminal can run `archimedes .`.
5. Launching a second file/folder inside an active workspace focuses the matching existing window and opens the requested path.
6. Launching a file/folder outside every active workspace opens a new isolated window with separate per-window content.
7. Launching Archimedes again from the taskbar/shortcut while it is already running opens a new empty isolated window.
8. CLI-style launches work for no args, `.`, folders, and files with spaces.

See `docs/OS_OPEN_AND_CLI.md` for the full checklist.

## Option B: Build using GitHub Actions

The repo now includes a tag-triggered desktop release workflow at:

```txt
.github/workflows/desktop-release.yml
```

Push a release tag such as `v1.2.3` from a commit on `main`. GitHub Actions will validate the tag ancestry, build Windows/Linux/macOS bundles, and upload platform artifacts.

The Windows artifact is uploaded with this naming pattern:

```txt
archimedes-agent-windows-x64-v<version>
```

See `docs/RELEASES.md` for the full release process and tag commands.

## Notes

- The app expects local Ollama to be running on the user's machine.
- Default endpoint: `http://localhost:11434`
- Default model: `gemma4:e4b`
