import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: '0.0.0.0',
    proxy: {
      '/__subscription-proxy/chatgpt': {
        target: 'https://chatgpt.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/__subscription-proxy\/chatgpt/, ''),
      },
      '/__subscription-proxy/auth': {
        target: 'https://auth.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/__subscription-proxy\/auth/, ''),
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
});
