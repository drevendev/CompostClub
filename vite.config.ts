import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), ...(mode === 'offline' ? [viteSingleFile()] : [])],
  define: { __OFFLINE__: JSON.stringify(mode === 'offline') },
  build: {
    outDir:
      mode === 'desktop'
        ? 'dist-desktop-ui'
        : mode === 'offline'
          ? 'dist-offline'
          : mode === 'lab'
            ? 'dist-lab'
            : 'dist',
    chunkSizeWarningLimit: 16000,
    ...(mode === 'lab' ? { rollupOptions: { input: 'experiments/index.html' } } : {}),
    ...(mode === 'desktop' ? { rollupOptions: { input: 'desktop.html' } } : {}),
  },
  worker: { format: 'es' },
  server: {
    watch: {
      ignored: ['**/.local/**', '**/brief/**', '**/dist*/**', '**/release/**', '**/evidence/**'],
    },
    fs: {
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/.local/**',
        '**/brief/**',
        '**/*.docx',
        '**/*.zip',
        '**/Compost_Club_GitHub_Pages_Plan_v1_1.md',
      ],
    },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
}));
