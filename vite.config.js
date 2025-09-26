import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 8080,
    open: '/index.html'
  },
  preview: {
    host: true,
    port: 8080,
    open: '/index.html'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
