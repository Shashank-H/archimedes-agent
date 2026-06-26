# Troubleshooting

## Browser shows `messages.map is not a function`

Cause: an earlier storage helper accidentally loaded chat history as an object instead of an array.

Status: fixed in `src/lib/storage.ts`.

If you still see it:

1. Hard refresh the browser.
2. Clear localStorage keys:

```js
localStorage.removeItem('gemma-diagram.chat.v1')
```

or clear all app storage for `localhost:1420`.

## Browser shows `Maximum update depth exceeded`

Cause: Excalidraw emits frequent `onChange` events. Updating React state for every canvas change caused a render loop.

Status: fixed by storing high-frequency diagram snapshots in a ref instead of React state.

If you still see it:

1. Hard refresh.
2. Restart the Vite dev server.
3. Clear localStorage scene if corrupted:

```js
localStorage.removeItem('gemma-diagram.scene.v1')
```

## Vite says port 1420 is already in use

Find the process:

```bash
ss -ltnp | grep ':1420'
```

Kill it if needed:

```bash
kill <pid>
```

Then restart:

```bash
npm run dev
```

## App cannot reach Ollama

Symptoms:

- status says Ollama unavailable;
- review requests fail;
- test connection fails.

Check Ollama:

```bash
ollama serve
```

In another terminal:

```bash
ollama list
ollama show gemma4:e4b
```

Default app endpoint:

```txt
http://localhost:11434
```

If running inside Tauri/browser with a different host setup, make sure the endpoint is reachable from the app environment.

## Model does not understand images

We verified `gemma4:e4b` can understand real PNG images locally. If it fails for you:

1. Confirm model details:

```bash
ollama show gemma4:e4b
```

2. Test with a real PNG, not a tiny synthetic base64 string.
3. Ensure the request uses the Ollama `images` array.
4. Try `stream: false` and `think: false` for simple debugging.

Manual test script is in `docs/DEVELOPMENT.md`.

## Review seems stale or does not match diagram

Possible causes:

- the diagram was changed after the request started;
- the current image export did not include what you expected;
- tiny text is unreadable;
- the model hallucinated or missed details.

Tips:

- click Review again after changes;
- make labels larger;
- keep the whole diagram visible/clear;
- ask the model to first describe what it sees.

Example prompt:

```txt
First describe exactly what you can see in the diagram, then review it.
```

## Proactive review is too chatty

Current defaults:

```txt
Delay: 12 seconds
Cooldown: 60 seconds
```

Options:

- turn off proactive review in settings;
- increase `proactiveCooldownMs` in `src/types.ts`;
- increase `proactiveDelayMs` in `src/types.ts`.

## Proactive review does not fire

Check:

- Auto-review is enabled in settings.
- Diagram has at least two live elements.
- Another model request is not active.
- Cooldown has elapsed.
- You made a meaningful scene change.

Selection-only changes are intended to be ignored.

## `npm run build` has large chunk warnings

Expected for now. Excalidraw and related assets are large.

Build still succeeds. Future fixes:

- manual Vite chunks;
- lazy load assistant/settings;
- analyze bundle;
- raise `build.chunkSizeWarningLimit` if acceptable.

## Tauri build fails: `cargo: command not found`

Rust/Cargo is missing from PATH.

If Rust was installed by rustup in Linux/WSL:

```bash
. ~/.cargo/env
cargo --version
```

Then retry:

```bash
npm run tauri -- build
```

## Tauri Linux build fails on `gobject-sys` / `pkg-config`

The Linux build environment is missing native WebKit/GObject development packages.

Typical Ubuntu/WSL packages may include:

```bash
sudo apt update
sudo apt install -y \
  pkg-config \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

Exact packages depend on Tauri/WebKit version and distro.

## Windows cross-build from WSL fails with `llvm-rc`

This happened in the current environment.

Error pattern:

```txt
NotAttempted("llvm-rc")
```

Reason: Windows resource compiler/linker tooling is missing or not configured for cross-compilation.

Recommended solution: build on native Windows or use GitHub Actions `windows-latest`.

See:

```txt
BUILD_WINDOWS.md
```

## PowerShell blocks npm scripts

On Windows, PowerShell may block `npm.ps1` due to execution policy.

Use Command Prompt:

```cmd
npm ci
npm run tauri -- build
```

Or adjust PowerShell execution policy if appropriate for your machine.

## Clear all local app data

In browser dev tools console:

```js
localStorage.removeItem('gemma-diagram.settings.v1')
localStorage.removeItem('gemma-diagram.scene.v1')
localStorage.removeItem('gemma-diagram.chat.v1')
location.reload()
```

This resets settings, diagram, and chat.
