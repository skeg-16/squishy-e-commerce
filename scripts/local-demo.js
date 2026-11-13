const fs = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');
const { execSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { embedded } = require('./embedded');
const { createPool } = require('../server/db');
const { createApp } = require('../server/app');
const { migrate } = require('./database');
const { seed } = require('../server/seed');
function isPortOpen(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
  });
}
(async () => {
  const directory = path.join(__dirname, '../.local');
  await fs.mkdir(directory, { recursive: true });
  const passwordFile = path.join(directory, 'database-password');
  let password;
  try { password = await fs.readFile(passwordFile, 'utf8'); }
  catch { password = randomBytes(24).toString('hex'); await fs.writeFile(passwordFile, password, { mode: 0o600 }); }
  const database = await embedded({ directory, port: 55432, password, persistent: true });
  const pool = createPool(database.url);
  await migrate(pool); await seed(pool);
  await fs.writeFile(path.join(directory, 'demo.env'), `DATABASE_URL=${database.url}\nDEMO_MODE=true\n`, { mode: 0o600 });
  require('./build').build();
  try {
    execSync('npx vite build', { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  } catch { /* Fallback to existing dist if vite build fails */ }
  const port = Number(process.env.PORT || 3000);
  let server = null;
  if (await isPortOpen(port)) {
    console.log(`Local school demo: http://localhost:${port} (Vite dev: http://127.0.0.1:5173)\nPostgreSQL data persists in .local/. Press Ctrl+C to stop.`);
  } else {
    const app = createApp({ pool, demoMode: true, origins: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174', `http://localhost:${port}`, `http://127.0.0.1:${port}`], serveStatic: true, serveReact: true });
    server = app.listen(port, () => console.log(`Local school demo: http://localhost:${port} (Vite dev: http://127.0.0.1:5173)\nPostgreSQL data persists in .local/. Press Ctrl+C to stop.`));
  }
  const keepAlive = setInterval(() => {}, 60000);
  let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true;
    clearInterval(keepAlive);
    if (server) await new Promise(resolve => server.close(resolve));
    await pool.end(); await database.stop();
  };
  process.on('SIGINT', () => stop().then(() => process.exit()));
  process.on('SIGTERM', () => stop().then(() => process.exit()));
})().catch(error => { console.error(`Local demo could not start: ${error.message}`); process.exitCode = 1; });
