import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import fs from 'node:fs';
import path from 'node:path';

function copyPreloadBridge() {
  return {
    name: 'copy-preload-bridge',
    closeBundle() {
      const src = path.resolve(__dirname, 'electron/preload-bridge.cjs');
      const destDir = path.resolve(__dirname, 'dist-electron');
      const dest = path.join(destDir, 'preload-bridge.cjs');
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(src, dest);
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
    open: false,
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.ts',
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
          plugins: [copyPreloadBridge()],
        },
      },
      // No Vite-bundled preload — we use electron/preload-bridge.cjs directly
    }),
  ],
  build: {
    outDir: 'dist',
  },
});
