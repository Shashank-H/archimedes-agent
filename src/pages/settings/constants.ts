export const PROJECT_GITHUB_URL = 'https://github.com/Shashank-H/archimedes-agent';
export const PERSONAL_SITE_URL = 'https://shashank.nirmaker.com/';
export const X_PROFILE_URL = 'https://x.com/ShashankH_';
export const LINKEDIN_PROFILE_URL = 'https://www.linkedin.com/in/shashank-h/';
export const OLLAMA_VISION_MODELS_URL = 'https://ollama.com/search?c=vision';

export const RECOMMENDED_VISION_MODELS = [
  {
    name: 'Gemma 4 E2B',
    tag: 'gemma4:e2b',
    bestFor: 'System requirements: under 8GB RAM. Choose this for lightweight local diagram review on modest machines.',
    command: 'ollama pull gemma4:e2b',
    url: 'https://ollama.com/library/gemma4:e2b',
  },
  {
    name: 'Gemma 4 E4B',
    tag: 'gemma4:e4b',
    bestFor: 'System requirements: 16GB RAM recommended. Choose this for higher-quality Archimedes diagram review.',
    command: 'ollama pull gemma4:e4b',
    url: 'https://ollama.com/library/gemma4:e4b',
  },
] as const;

export const OPEN_SOURCE_CREDITS = [
  { name: 'Design.md Vercel analysis', packageName: 'getdesign.md/vercel/design-md', license: 'Independent public design analysis', url: 'https://getdesign.md/vercel/design-md', note: 'Vercel-inspired DESIGN.md reference used for visual direction; not affiliated with Vercel.' },
  { name: 'Excalidraw', packageName: '@excalidraw/excalidraw', license: 'MIT', url: 'https://github.com/excalidraw/excalidraw', note: 'Embeddable whiteboard and diagram canvas.' },
  { name: 'Tauri', packageName: '@tauri-apps/api / @tauri-apps/cli', license: 'Apache-2.0 OR MIT', url: 'https://tauri.app', note: 'Desktop app runtime, APIs, and build tooling.' },
  { name: 'Tauri Dialog Plugin', packageName: 'tauri-plugin-dialog', license: 'Apache-2.0 OR MIT', url: 'https://github.com/tauri-apps/plugins-workspace', note: 'Native desktop folder picker used by workspace opening.' },
  { name: 'PostHog JS', packageName: 'posthog-js', license: 'See package LICENSE', url: 'https://posthog.com/docs/libraries/js', note: 'Privacy-aware product analytics client.' },
  { name: 'Radix UI', packageName: '@radix-ui/*', license: 'MIT', url: 'https://www.radix-ui.com', note: 'Accessible primitives and icons used for dialogs, switches, tooltips, and app iconography.' },
  { name: 'React', packageName: 'react / react-dom', license: 'MIT', url: 'https://react.dev', note: 'User-interface rendering framework.' },
  { name: 'Tauri HTTP Plugin', packageName: '@tauri-apps/plugin-http / tauri-plugin-http', license: 'Apache-2.0 OR MIT', url: 'https://github.com/tauri-apps/plugins-workspace', note: 'Desktop HTTP client used by OpenAI Codex OAuth without a custom Rust proxy.' },
  { name: 'React Hotkeys Hook', packageName: 'react-hotkeys-hook', license: 'MIT', url: 'https://github.com/JohannesKlauss/react-hotkeys-hook', note: 'Global keyboard shortcut handling.' },
  { name: 'Vite', packageName: 'vite / @vitejs/plugin-react', license: 'MIT', url: 'https://vite.dev', note: 'Development server and production bundler.' },
  { name: 'TypeScript', packageName: 'typescript', license: 'Apache-2.0', url: 'https://www.typescriptlang.org', note: 'Typed JavaScript language tooling.' },
  { name: 'DefinitelyTyped', packageName: '@types/node / @types/react / @types/react-dom', license: 'MIT', url: 'https://github.com/DefinitelyTyped/DefinitelyTyped', note: 'Community TypeScript type definitions.' },
] as const;

export type LocalOllamaOs = 'windows' | 'mac' | 'linux';

export const OLLAMA_OS_OPTIONS: Array<{ value: LocalOllamaOs; label: string }> = [
  { value: 'windows', label: 'Windows' },
  { value: 'mac', label: 'macOS' },
  { value: 'linux', label: 'Linux' },
];

export type OllamaOriginInstruction = {
  backgroundCommand: string;
  permanentCommand: string;
  permanentNote: string;
  verifyCommand: string;
  description: string;
  quitSteps: string[];
  quitCommand?: string;
};

export function getOllamaOriginInstructions(siteOrigin: string): Record<LocalOllamaOs, OllamaOriginInstruction> {
  return {
    windows: {
      backgroundCommand: `Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile -Command "$env:OLLAMA_ORIGINS=\"${siteOrigin}\"; ollama serve"'`,
      permanentCommand: `setx OLLAMA_ORIGINS "${siteOrigin}"`,
      permanentNote: 'Recommended. After running setx, quit and reopen Ollama. Windows applies setx values only to new processes.',
      verifyCommand: `curl.exe -i -H "Origin: ${siteOrigin}" http://localhost:11434/api/tags`,
      description: 'Use these steps to permanently allow this site, then reopen Ollama normally.',
      quitSteps: [
        'Click the Ollama llama icon in the Windows system tray and choose Quit, if it is visible.',
        'If it is not visible, open Task Manager and end any Ollama or ollama.exe process.',
        'PowerShell alternative:',
      ],
      quitCommand: 'taskkill /IM ollama.exe /F',
    },
    mac: {
      backgroundCommand: `mkdir -p ~/.ollama && nohup env OLLAMA_ORIGINS="${siteOrigin}" ollama serve > ~/.ollama/ollama.log 2>&1 &`,
      permanentCommand: `launchctl setenv OLLAMA_ORIGINS "${siteOrigin}"`,
      permanentNote: 'Recommended for the Ollama desktop app. After running launchctl, quit and reopen the Ollama app. You may need to run it again after a reboot.',
      verifyCommand: `curl -i -H "Origin: ${siteOrigin}" http://localhost:11434/api/tags`,
      description: 'Use these steps to allow this site for the Ollama app, then reopen Ollama normally.',
      quitSteps: [
        'Click the Ollama llama icon in the macOS menu bar and choose Quit Ollama.',
        'If the menu bar icon is not available, run the terminal command below to stop the background process.',
      ],
      quitCommand: 'pkill ollama',
    },
    linux: {
      backgroundCommand: `sudo systemctl stop ollama 2>/dev/null || true; pkill ollama 2>/dev/null || true; mkdir -p ~/.ollama && nohup env OLLAMA_ORIGINS="${siteOrigin}" ollama serve > ~/.ollama/ollama.log 2>&1 &`,
      permanentCommand: `sudo mkdir -p /etc/systemd/system/ollama.service.d && printf '%s\n' '[Service]' 'Environment="OLLAMA_ORIGINS=${siteOrigin}"' | sudo tee /etc/systemd/system/ollama.service.d/override.conf >/dev/null && sudo systemctl daemon-reload && sudo systemctl restart ollama`,
      permanentNote: 'Recommended when Ollama is installed as a systemd service. It writes a service override and restarts Ollama automatically.',
      verifyCommand: `curl -i -H "Origin: ${siteOrigin}" http://localhost:11434/api/tags`,
      description: 'Use these steps to permanently allow this site for the Ollama service.',
      quitSteps: [
        'If Ollama is running as a systemd service, stop it first.',
        'If you started Ollama manually, stop the process instead.',
      ],
      quitCommand: 'sudo systemctl stop ollama 2>/dev/null || true; pkill ollama 2>/dev/null || true',
    },
  };
}
