# Usage Guide

## Start the app in browser/dev mode

From the project root:

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:1420
```

If another dev server is already running, Vite may report that port 1420 is in use. In that case, open the existing server URL or stop the old process.

## Start Ollama

The assistant needs local Ollama.

```bash
ollama serve
```

Check the model:

```bash
ollama show gemma4:e4b
```

The app defaults to:

```txt
Endpoint: http://localhost:11434
Model: gemma4:e4b
```

## Main screen

The app has two panes:

```txt
+---------------------------+----------------------+
| Excalidraw diagram canvas | Gemma Reviewer panel |
+---------------------------+----------------------+
```

### Left: diagram canvas

Use this like normal Excalidraw:

- draw boxes, arrows, text, frames, etc.;
- create system-design diagrams;
- label components clearly for better model feedback.

### Right: assistant panel

The assistant panel contains:

- model/status line;
- settings button;
- **Review diagram** button;
- chat history;
- prompt box;
- send button.

## Manual diagram review

1. Draw a diagram.
2. Click **Review diagram**.
3. The app exports the current diagram as an image.
4. The image and lightweight metadata are sent to local Ollama.
5. The assistant streams a review.

Manual review prompt style:

- concise architecture review;
- questions;
- risks;
- suggestions.

## Chat with the diagram

Type a question in the prompt box, for example:

```txt
What is missing for production readiness?
```

or:

```txt
Where would this design bottleneck first?
```

When you send a chat message, the app also exports the current diagram image and includes it with your prompt. This means the model answers using the current visual state of the diagram.

Keyboard shortcut:

```txt
Ctrl/Cmd + Enter
```

sends the chat message from the textarea.

## Proactive review

If proactive review is enabled, the assistant can comment without you clicking review.

Current behavior:

1. You make a meaningful diagram change.
2. The app waits for inactivity.
3. After the delay, it exports the current diagram image.
4. It asks Gemma for one concise observation or question.

Defaults:

```txt
Inactivity delay: 12 seconds
Cooldown: 60 seconds
```

Important: proactive review is change-triggered. If there are no new meaningful diagram changes after a previous screenshot, the app does not keep sending screenshots.

## Settings

Click **Settings** in the assistant panel.

Available settings:

- Ollama endpoint;
- model name;
- temperature;
- proactive review toggle;
- test Ollama connection.

Default values:

```txt
Ollama endpoint: http://localhost:11434
Model: gemma4:e4b
Temperature: 0.3
Auto review: enabled
```

## What is sent to the model?

The app sends:

1. The exported diagram image as base64.
2. Your prompt or review instruction.
3. A small metadata summary.

The metadata summary may include:

- element count;
- visible text labels;
- arrows/connectors;
- group counts;
- unlabeled component count.

The app does **not** send the full Excalidraw JSON to Ollama.

## What is saved locally?

The app saves these in browser/webview localStorage:

- latest Excalidraw scene;
- assistant chat history;
- settings.

Storage keys:

```txt
gemma-diagram.settings.v1
gemma-diagram.scene.v1
gemma-diagram.chat.v1
```

## Tips for better reviews

The model reads the diagram image, so visual clarity matters.

Good practices:

- label every service/component;
- label important arrows;
- group related services;
- use clear text for data stores, queues, caches, external systems;
- avoid tiny text;
- keep the diagram within a visible region before review.

Example useful prompts:

```txt
Review this for scale bottlenecks.
```

```txt
What failure modes are missing here?
```

```txt
What questions would you ask in a design review?
```

```txt
Does this need a queue or cache anywhere?
```

```txt
What security boundaries should I add?
```

## Known user-facing limitations

- The app is currently prototype-grade.
- No project/file manager yet.
- Persistence is localStorage-based.
- No one-click diagram export/import UI yet.
- No cancel button for in-flight model calls.
- If Ollama is slow, the assistant can appear busy for a while.
- If the diagram image export fails, review will fail or fall back poorly.
