import { defineConfig, loadEnv } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig(({ mode }) => {
  // Load .env, .env.local, .env.[mode], .env.[mode].local — makes VITE_* vars
  // available in the config itself (not just the app bundle).
  const env = loadEnv(mode, process.cwd(), '');

  // When running inside Docker, VITE_API_TARGET is set to the server service name.
  // Locally it falls back to localhost:8787 (Cloudflare Worker dev server).
  const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:8787';
  const wsTarget  = apiTarget.replace(/^http/, 'ws');
  const isDocker  = !!process.env.VITE_API_TARGET;

  // Production API base URL — empty in dev (Vite proxy handles /api).
  const apiBase = env.VITE_API_BASE_URL ?? '';

  return {
  define: {
    'import.meta.env.APP_VERSION': JSON.stringify(pkg.version),
    '__API_BASE__': JSON.stringify(apiBase),
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
  };
});
