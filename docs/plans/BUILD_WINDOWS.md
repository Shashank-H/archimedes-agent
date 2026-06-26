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

## Option B: Build using GitHub Actions

A workflow has been added at:

```txt
.github/workflows/windows-build.yml
```

Push the repo to GitHub, then run **Actions → Build Windows EXE → Run workflow**.

The built installer artifacts will be uploaded as:

```txt
gemma-diagram-brainstormer-windows
```

## Notes

- The app expects local Ollama to be running on the user's machine.
- Default endpoint: `http://localhost:11434`
- Default model: `gemma4:e4b`
