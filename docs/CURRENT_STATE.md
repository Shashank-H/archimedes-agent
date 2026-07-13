# Current State Snapshot

This document summarizes exactly what exists right now in the repo.

## Product idea

A local-first diagramming and brainstorming app:

- User draws architecture/system-design diagrams.
- Excalidraw handles drawing.
- A right-side assistant powered by local Ollama reviews the diagram.
- The assistant can comment manually or proactively.

## Current implementation status

### Done

- Project scaffolded with Vite, React, TypeScript, and Tauri.
- Excalidraw embedded and rendering in the app.
- Assistant panel implemented.
- Manual review implemented.
- Chat implemented.
- Proactive review implemented.
- Unified assistant conversation with automatic chat/review/edit/review-and-edit intent routing.
- All assistant behavior, including proactive review, runs through a LangGraph supervisor workflow.
- Composable LangGraph review and diagram-edit branches support requests such as “review this and fix it.”
- LangGraph agentic diagram editing includes inspect, brief, plan, validation, atomic commit, verify, and response stages.
- Agent workflow progress and cancellation implemented in the assistant UI.
- Automated Vitest coverage exists for workflow routing, retry, cancellation, and plan validation.
- Diagram image export implemented.
- Ollama streaming implemented.
- Settings implemented.
- localStorage persistence implemented.
- `gemma4:e4b` image understanding verified with real PNG images.
- Frontend production build passes.
- Browser dev mode works.

### Not done

- Windows installer/exe has not been produced locally.
- Native desktop bundle has not been produced in this environment.
- Production hardening is not done.

- No file/project manager yet.
- No polished visual design yet.

## Important decisions

### Excalidraw is the diagram base

We are using:

```txt
@excalidraw/excalidraw
```

not the old `excalidraw` npm package.

### Ollama only for now

The app targets local Ollama by default:

```txt
http://localhost:11434
```

### Model default

```txt
gemma4:e4b
```

### Image-first agent context

The app sends exported diagram images to the model. It does not rely on raw Excalidraw JSON for the main review.

### Metadata is secondary

The app sends a lightweight metadata summary as text context. This helps the model reason about labels/arrows but is not the primary input.

### Full diagram JSON stays local

The full Excalidraw scene is saved locally to restore the diagram after refresh. It is not sent wholesale to Ollama.

## Verified facts

### npm/frontend

`npm run build` passes.

### Dev server

Vite serves the app at:

```txt
http://localhost:1420
```

### Ollama vision

A real PNG test succeeded. `gemma4:e4b` correctly read `TEST 739` and identified colored shapes.

A generated architecture diagram test also succeeded. The model gave relevant system-design review feedback.

### Build blockers

Native package builds are environment-blocked, not app-code-blocked.

Known local blockers:

- Linux/WSL Tauri build needs native WebKit/GObject/pkg-config dev packages.
- Windows cross-build from WSL needs Windows resource compiler/linker tooling.
- Native Windows build or GitHub Actions is recommended for `.exe`.

## Runtime behavior

### When images are captured

Images are captured only when needed:

1. Manual review.
2. Chat send.
3. Proactive review after meaningful change + inactivity.

No continuous screenshots are taken.

### Proactive review behavior

A proactive review will not repeat if nothing changes after the last screenshot. It is change-triggered, not timer-polling.

### Persistence behavior

The app writes to localStorage:

- settings;
- scene snapshot;
- chat messages.

## Known bugs already fixed

### `messages.map is not a function`

Fixed by preserving arrays in `storage.ts` instead of object-spreading parsed arrays.

### `Maximum update depth exceeded`

Fixed by storing high-frequency Excalidraw snapshots in refs instead of React state, memoizing initial data, and removing StrictMode for now.

## Next recommended tasks

1. Build on native Windows and produce `.exe`/`.msi`.
2. Add cancel/stop button for model calls.
3. Add explicit project save/load.
4. Add model diagnostics panel.
5. Add prompt presets.
6. Add automated tests around `diagramSummary`, `storage`, and Ollama stream parsing.
7. Improve UI polish.
8. Harden Tauri security config.
