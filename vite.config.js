import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SPA_HTML_PATHS = new Set([
  '/index.html',
  '/shop',
  '/shop.html',
  '/product',
  '/product.html',
  '/checkout',
  '/checkout.html',
  '/about',
  '/about.html',
  '/account',
  '/account.html',
  '/admin',
  '/admin.html',
]);

function isPortListening(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function squishiesDevPlugin() {
  let apiProcess = null;

  return {
    name: 'squishies-dev-plugin',
    configureServer(server) {
      // Rewrite legacy .html routes before servePublicMiddleware so Vite serves the React SPA
      server.middlewares.use((req, _res, next) => {
        if (req.url && (req.method === 'GET' || req.method === 'HEAD')) {
          const [pathname, search = ''] = req.url.split('?');
          if (SPA_HTML_PATHS.has(pathname)) {
            req.url = `/${search ? `?${search}` : ''}`;
          }
        }
        next();
      });

      function ensureApiServer() {
        isPortListening(3000).then((listening) => {
          if (listening || apiProcess) return;
          apiProcess = spawn(
            process.execPath,
            [path.join(__dirname, 'server/server.js')],
            {
              cwd: __dirname,
              stdio: 'inherit',
              env: { ...process.env, DEMO_MODE: process.env.DEMO_MODE || 'true' },
            }
          );
          apiProcess.on('exit', () => {
            apiProcess = null;
          });
        });
      }

      // Automatically boot the API + embedded DB on port 3000 if not already running
      ensureApiServer();
      const bootRetryTimer = setTimeout(ensureApiServer, 800);

      server.httpServer?.once('close', () => {
        clearTimeout(bootRetryTimer);
        if (apiProcess) {
          apiProcess.kill();
          apiProcess = null;
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [ squishiesDevPlugin(), react() ],
  publicDir: 'public',

  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('three') ||
              id.includes('@react-three') ||
              id.includes('troika') ||
              id.includes('maath')
            ) {
              return 'vendor-three';
            }
            if (
              id.includes('react') ||
              id.includes('scheduler') ||
              id.includes('remix-run')
            ) {
              return 'vendor-react';
            }
          }
          return undefined;
        },
      },
    },
  },
});
