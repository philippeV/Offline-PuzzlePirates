import { defineConfig } from 'vite';

export const DEV_SERVER_PORT = 5178;

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  cacheDir: '../../node_modules/.vite',
  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
