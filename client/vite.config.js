import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// When running inside Docker, VITE_API_TARGET is set to the server service name.
// Locally it falls back to localhost:3000.
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:3000';
const wsTarget  = apiTarget.replace(/^http/, 'ws');
const isDocker  = !!process.env.VITE_API_TARGET;

export default defineConfig({
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
  },
  server: {
    host: true,
    port: 8080,
    // Don't try to open a browser when running inside a container
    open: isDocker ? false : '/index.html',
    watch: {
      // Enable polling when CHOKIDAR_USEPOLLING=true (Docker / Linux inotify setups)
      usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
    },
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/ws': {
        target: wsTarget,
        ws: true,
      },
    },
  },
  preview: {
    host: true,
    port: 8080,
    open: '/index.html',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        checkoutComplete: 'checkout-complete.html',
      },
    },
  },
});
