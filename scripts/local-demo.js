const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { embedded } = require('./embedded');
const { createPool } = require('../server/db');
const { createApp } = require('../server/app');
const { migrate } = require('./database');
const { seed } = require('../server/seed');
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
  const port = Number(process.env.PORT || 3000);
  const app = createApp({ pool, demoMode: true, origins: [`http://localhost:${port}`, `http://127.0.0.1:${port}`], serveStatic: true });
  const server = app.listen(port, () => console.log(`Local school demo: http://localhost:${port}\nPostgreSQL data persists in .local/. Press Ctrl+C to stop.`));
  let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true;
    await new Promise(resolve => server.close(resolve)); await pool.end(); await database.stop();
  };
  process.on('SIGINT', () => stop().then(() => process.exit()));
  process.on('SIGTERM', () => stop().then(() => process.exit()));
})().catch(error => { console.error(`Local demo could not start: ${error.message}`); process.exitCode = 1; });
