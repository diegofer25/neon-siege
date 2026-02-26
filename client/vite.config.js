import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 8080,
    open: '/index.html',
    proxy: {
      '/api': 'http://localhost:3000'
    }
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
