import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'assets',
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
