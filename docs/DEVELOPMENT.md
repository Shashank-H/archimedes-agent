# Development Guide

## Stack

- Tauri v2
- Vite 7
- React 19
- TypeScript 5.8
- Excalidraw package: `@excalidraw/excalidraw`
- Ollama local HTTP API
- Rust/Cargo for desktop packaging

## Install dependencies

```bash
npm install
```

A `package-lock.json` is present, so CI or clean installs can use:

```bash
npm ci
```

## Run frontend dev server

```bash
npm run dev
```

Vite serves on port 1420 due to `vite.config.ts`:

```ts
server: {
  port: 1420,
  strictPort: true,
  host: '0.0.0.0',
}
```

Open:

```txt
http://localhost:1420
```

## Build frontend

```bash
npm run build
```

This runs:

```bash
tsc && vite build
```

Known warning: the build emits large chunk warnings because Excalidraw is large. This is expected for now.

## Run Tauri dev mode

Requires Rust/Cargo and platform dependencies.

```bash
npm run tauri -- dev
```

## Build Tauri bundle

```bash
npm run tauri -- build
```

Windows-specific instructions are in:

```txt
BUILD_WINDOWS.md
```

## Important implementation notes

### Excalidraw CSS

Excalidraw requires its CSS import:

```ts
import '@excalidraw/excalidraw/index.css';
```

This is done in `DiagramCanvas.tsx`.

### Excalidraw container height

The canvas container must have non-zero height. Relevant CSS:

```css
html, body, #root { width: 100%; height: 100%; margin: 0; }
.app-shell { display: flex; width: 100vw; height: 100vh; overflow: hidden; }
.canvas-pane { flex: 1 1 auto; height: 100%; }
.diagram-canvas { height: 100%; width: 100%; }
```

### Avoid React state for high-frequency diagram changes

Do not store every Excalidraw `onChange` snapshot in React state. That previously caused maximum update depth errors.

Current pattern:

- store latest snapshot in `snapshotRef`;
- debounce persistence to localStorage;
- only use React state for settings/messages/status/busy state.

### React StrictMode

`React.StrictMode` was removed for now. In development, StrictMode double-mount behavior can make Excalidraw integration issues harder to reason about. Re-enable only after testing carefully.

### TypeScript module resolution

`tsconfig.json` uses:

```json
"moduleResolution": "Bundler"
```

This was needed for Excalidraw type import paths.

## Ollama API details

The app calls:

```txt
POST http://localhost:11434/api/chat
```

Streaming request:

```json
{
  "model": "gemma4:e4b",
  "stream": true,
  "options": { "temperature": 0.3 },
  "messages": [
    { "role": "system", "content": "..." },
    {
      "role": "user",
      "content": "...",
      "images": ["<base64 image>"]
    }
  ]
}
```

The stream parser expects newline-delimited JSON and appends `message.content` tokens.

## Testing Ollama manually

Generate a simple test image with ffmpeg:

```bash
ffmpeg -y -f lavfi -i color=c=white:s=640x360 \
  -vf "drawbox=x=40:y=60:w=160:h=160:color=blue@1:t=fill,drawbox=x=260:y=70:w=200:h=120:color=red@1:t=fill,drawtext=text='TEST 739':x=250:y=230:fontsize=54:fontcolor=black" \
  -frames:v 1 /tmp/gemma_vision_test.png
```

Send it to Ollama:

```bash
node - <<'JS'
import { readFileSync } from 'node:fs';
const image = readFileSync('/tmp/gemma_vision_test.png').toString('base64');
const res = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'gemma4:e4b',
    stream: false,
    think: false,
    options: { temperature: 0 },
    messages: [{
      role: 'user',
      content: 'What text is written in this image, and what colored shapes are visible?',
      images: [image],
    }],
  }),
});
console.log(await res.text());
JS
```

Expected: model identifies `TEST 739` and the colored shapes.

## Source file guide

### `src/types.ts`

Shared app types:

- `AppSettings`
- `ChatMessage`
- `DiagramSnapshot`
- `DiagramSummary`
- `DiagramExport`
- `DEFAULT_SETTINGS`

### `src/App.tsx`

Main app logic:

- load/save settings and chat;
- maintain current snapshot ref;
- schedule proactive reviews;
- export diagram image;
- call Ollama;
- stream response into chat messages.

### `src/components/DiagramCanvas.tsx`

Excalidraw wrapper.

### `src/components/AssistantPanel.tsx`

UI-only panel for chat/settings/review controls.

### `src/lib/diagramImage.ts`

Image export and base64 conversion.

### `src/lib/diagramSummary.ts`

Metadata extraction and scene signature generation.

### `src/lib/storage.ts`

localStorage read/write helpers.

### `src/lib/llm/ollama.ts`

Ollama HTTP client and stream parser.

### `src/lib/llm/prompts.ts`

System prompt and mode-specific prompt builder.

## Environment-specific build notes

### WSL/Linux

Frontend build works.

Native Tauri Linux build may require packages such as WebKitGTK/GObject/pkg-config development libraries.

Windows cross-build from WSL is not straightforward. Attempts hit missing Windows resource compiler/linker tooling such as `llvm-rc`.

### Windows

Recommended for producing `.exe`/`.msi`.

Install:

- Node.js
- Rust via rustup
- Visual Studio Build Tools with Desktop development with C++
- Windows SDK

Then:

```cmd
npm ci
npm run tauri -- build
```

## CI

A GitHub Actions workflow exists:

```txt
.github/workflows/windows-build.yml
```

It builds on `windows-latest` and uploads Windows bundle artifacts.

## Suggested next development tasks

1. Add a cancel button for in-flight Ollama calls.
2. Add project save/load using Tauri filesystem APIs.
3. Add model capability diagnostics to settings.
4. Add a "last screenshot time" indicator.
5. Add prompt presets for scale/security/reliability/cost reviews.
6. Add E2E tests with mocked Ollama responses.
7. Optimize bundle chunks.
8. Harden Tauri CSP for production.
