# Architecture

## Overview

Archimedes Agent is currently a client-heavy Tauri/Vite application. The Rust/Tauri layer provides the desktop shell, while the React frontend owns the diagram editor, assistant UI, local persistence, and Ollama communication.

The assistant is one conversation backed entirely by LangGraph. `src/lib/assistant-agent/workflow.ts` is the supervisor graph: it classifies each request as conversation, review, edit, or review-and-edit, then routes into focused graph branches. Proactive reviews enter the same graph with an explicit system intent. The review-and-edit route composes critique with the diagram-edit subgraph, so findings become edit-plan context rather than a disconnected response.

Canvas mutation remains isolated in `src/lib/diagram-agent/workflow.ts`. That subgraph inspects the active workspace snapshot, prepares a brief, asks the selected provider for a validated operation plan, preflights the full plan, atomically applies and saves it to the starting tab, rereads the canvas for verification, and reports the result. Switching tabs aborts before commit, and persistence failures restore the in-memory snapshot. Provider access remains behind `LlmProviderFactory`, while workspace mutations remain behind `WorkspaceTabManagerContext`.

```txt
+-------------------------------------------------------------+
| Tauri desktop shell / Vite browser dev server               |
|                                                             |
|  +------------------------+  +----------------------------+  |
|  | Excalidraw canvas      |  | Assistant panel            |  |
|  |                        |  |                            |  |
|  | - drawing surface      |  | - chat messages           |  |
|  | - scene change events  |  | - review button           |  |
|  | - image export source  |  | - settings                |  |
|  +-----------+------------+  +-------------+--------------+  |
|              |                             |                 |
|              v                             v                 |
|  +------------------------+  +----------------------------+  |
|  | Local persistence      |  | Agent orchestration        |  |
|  | localStorage           |  | image export + prompts     |  |
|  +------------------------+  +-------------+--------------+  |
|                                            |                 |
+--------------------------------------------|-----------------+
                                             v
                              +-----------------------------+
                              | Local Ollama                |
                              | http://localhost:11434      |
                              | model: gemma4:e4b           |
                              +-----------------------------+
```

## Main runtime components

### `src/App.tsx`

`App.tsx` is the main orchestrator. It owns:

- settings state;
- chat messages;
- current Excalidraw snapshot ref;
- persistence timers;
- proactive-review timers;
- Ollama request lifecycle;
- assistant message streaming updates.

Important implementation detail: diagram changes are stored in a React ref, not normal React state. Excalidraw emits frequent `onChange` events. Keeping every scene update in React state caused maximum-update-depth loops, so the latest diagram snapshot is now stored in `snapshotRef` and persisted on a debounce.

### `src/components/DiagramCanvas.tsx`

This wraps the Excalidraw React component.

Responsibilities:

- import Excalidraw and its CSS;
- pass memoized `initialData` from local storage;
- expose the Excalidraw imperative API to the parent;
- emit sanitized snapshots on scene change.

The Excalidraw container must have non-zero height. The CSS sets the diagram pane and canvas to full viewport height.

### `src/components/AssistantPanel.tsx`

The assistant panel is a right-side UI for:

- showing model/status text;
- displaying chat/review messages;
- sending user prompts;
- triggering manual diagram review;
- changing settings;
- testing Ollama connectivity;
- clearing chat.

It does not call Ollama directly. It delegates to callbacks from `App.tsx`.

### `src/lib/diagramImage.ts`

Exports the current Excalidraw scene to an image.

Flow:

1. Filter deleted elements.
2. Call Excalidraw `exportToBlob`.
3. Export as PNG by default.
4. Convert Blob to base64.
5. Return `{ base64, mimeType, summary }`.

This base64 string is sent to Ollama without a `data:image/png;base64,` prefix.

### `src/lib/diagramSummary.ts`

Produces small secondary text context for the model.

Current summary includes:

- live element count;
- text labels;
- arrows and bindings;
- group counts;
- unlabeled component count;
- a small list of obvious unlabeled component IDs.

This is intentionally not the full Excalidraw JSON. The model primarily receives the image.

### `src/lib/llm/ollama.ts`

Ollama client for local HTTP calls.

Current capabilities:

- `streamOllamaChat` posts to `/api/chat`;
- supports `messages[].images` payloads;
- parses newline-delimited streaming JSON;
- appends streamed tokens via callback;
- `testOllamaConnection` calls `/api/tags` and checks selected model metadata.

Request shape:

```json
{
  "model": "gemma4:e4b",
  "stream": true,
  "options": { "temperature": 0.3 },
  "messages": [
    { "role": "system", "content": "..." },
    {
      "role": "user",
      "content": "Review this architecture diagram...",
      "images": ["<base64-png>"]
    }
  ]
}
```

### `src/lib/llm/prompts.ts`

Defines the assistant's behavior.

The system prompt tells the model to:

- act as a collaborative architecture brainstorming partner;
- inspect the diagram image first;
- ask clarifying questions;
- identify risks, assumptions, bottlenecks, and tradeoffs;
- be concise for proactive reviews;
- admit uncertainty when the diagram is unclear.

### `src/lib/storage.ts`

Simple localStorage persistence.

Keys:

- `archimedes-agent.settings.v1`
- `archimedes-agent.scene.v1`
- `archimedes-agent.chat.v1`

A bug was fixed where array fallbacks were incorrectly object-spread. Arrays now remain arrays when loaded.

## Image capture timing

Images are exported only when an agent request is about to be made:

1. User clicks **Review diagram**.
2. User sends a chat message.
3. Proactive review fires after meaningful scene change + inactivity.

The app does not continuously screenshot or stream frames.

## Proactive review algorithm

A proactive review is scheduled only after a meaningful scene signature change.

Current logic:

1. Excalidraw `onChange` emits a snapshot.
2. App builds a scene signature using element IDs, type, position, size, version, and text.
3. If signature changed, reset the inactivity timer.
4. If auto-review is enabled, schedule a review after `proactiveDelayMs`.
5. Before sending, check:
   - not already busy;
   - enough live elements;
   - cooldown has elapsed.
6. Export current image and call Ollama.

Defaults:

```ts
proactiveDelayMs: 12_000
proactiveCooldownMs: 60_000
```

If nothing changes after the previous screenshot, no new proactive screenshot is sent.

## Local persistence model

Persistence is currently browser/webview localStorage. This is good enough for a prototype, but later versions should move to proper file/project storage through Tauri APIs.

Current persisted data:

- latest diagram scene snapshot;
- assistant chat messages;
- settings and proactive-review preferences.

## Tauri layer

Tauri v2 is scaffolded in `src-tauri/`.

Current Rust layer is minimal:

- initializes Tauri;
- installs `tauri-plugin-opener`;
- opens one main window;
- delegates nearly all behavior to the frontend.

`tauri.conf.json` sets:

- product name: `Archimedes Agent`;
- dev URL: `http://localhost:1420`;
- frontend dist: `../dist`;
- window size: 1400x900;
- CSP: `null` for now.

## Privacy and network boundaries

By default, network calls go only to:

```txt
http://localhost:11434
```

The user can edit the endpoint. If they set a remote endpoint, exported diagram images and prompts will be sent there.

No cloud LLM integration exists in the codebase.

## Current build status

- `npm run build` passes.
- Browser dev mode works.
- Local image-understanding tests with Ollama image understanding succeeded.
- Tauri packaging has not been completed in this environment.

## Architectural risks / future improvements

- Move persistence from localStorage to project files or SQLite.
- Add explicit diagram export/import.
- Add cancellation UI for long model calls.
- Add model capability diagnostics in settings.
- Add chunk splitting/manual chunks for bundle size.
- Harden Tauri CSP for production.
- Add E2E tests for canvas export and Ollama mocks.
- Support two-model workflow: vision model describes image, reasoning model critiques architecture.
