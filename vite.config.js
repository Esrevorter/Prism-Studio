import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Prism Studio prototype config.
// NOTE: In production this app is intended to run inside Tauri (see spec.md §4).
// This Vite setup keeps the exact same frontend so it can be wrapped by Tauri later.
export default defineConfig({
  plugins: [react()],
  server: { port: 1420, strictPort: true },
});
