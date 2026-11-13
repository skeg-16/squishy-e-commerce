import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function squishiesAdminDevPlugin() {
  let apiProcess = null;

  return {
    name: 'squishies-admin-dev-plugin',
    configureServer(server) {
      // Serve standalone React Admin Console directly on `/` and `/admin` (bypassing legacy public/admin.html)
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.method === 'GET' || req.method === 'HEAD')) {
          const [pathname] = req.url.split('?');
          if (pathname === '/' || pathname === '/admin' || pathname === '/admin.html') {
            try {
              const rawHtml = fs.readFileSync(path.resolve(__dirname, 'admin.html'), 'utf8');
              const html = await server.transformIndexHtml(req.url, rawHtml);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'text/html');
              res.end(req.method === 'HEAD' ? undefined : html);
              return;
            } catch (err) {
              next(err);
              return;
            }
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
  plugins: [squishiesAdminDevPlugin(), react()],
  publicDir: 'public',
  cacheDir: 'node_modules/.vite-admin',
  optimizeDeps: {
    entries: ['admin.html'],
  },

  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
    },
  },

  build: {
    outDir: 'dist-admin',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'admin.html'),
    },
  },
});
