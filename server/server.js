const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { createPool } = require('./db');
const { createApp } = require('./app');
let app;
function getApp() {
  if (!app) {
    const port = process.env.PORT || '3000';
    const origins = [process.env.APP_ORIGIN, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`, process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`].filter(Boolean);
    if (!process.env.VERCEL) origins.push(`http://localhost:${port}`, `http://127.0.0.1:${port}`, 'http://localhost:5173', 'http://127.0.0.1:5173');
    if (!origins.length) throw new Error('APP_ORIGIN must be configured.');
    const pool = createPool();
    app = createApp({ pool, demoMode: process.env.DEMO_MODE === 'true', origins,
      secureCookies: Boolean(process.env.VERCEL) || origins.every(o => o.startsWith('https://')), serveStatic: !process.env.VERCEL });
  }
  return app;
}
module.exports = (req, res) => {
  try { return getApp()(req, res); }
  catch { res.statusCode = 503; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: false, code: 'SERVICE_UNAVAILABLE', error: 'The backend is not configured. Please try again later.' })); }
};
if (require.main === module) {
  (async () => {
    let database;
    const hasConfiguredDb =
      process.env.DATABASE_URL &&
      !process.env.DATABASE_URL.includes('USER:PASSWORD@HOST');
    if (!hasConfiguredDb) {
      const { embedded } = require('../scripts/embedded');
      const { migrate } = require('../scripts/database');
      const { seed } = require('./seed');
      const directory = path.join(__dirname, '../.local');
      await fs.mkdir(directory, { recursive: true });
      const passwordFile = path.join(directory, 'database-password');
      let password;
      try { password = await fs.readFile(passwordFile, 'utf8'); }
      catch { password = randomBytes(24).toString('hex'); await fs.writeFile(passwordFile, password, { mode: 0o600 }); }
      database = await embedded({ directory, port: 55432, password, persistent: true });
      process.env.DATABASE_URL = database.url;
      process.env.DEMO_MODE ||= 'true';
      const bootstrapPool = createPool(database.url);
      await migrate(bootstrapPool);
      await seed(bootstrapPool);
      await bootstrapPool.end();
    }
    require('../scripts/build').build();
    const port = process.env.PORT || 3000;
    const server = getApp().listen(port, () => console.log(`Squishies: http://localhost:${port}`));
    let stopping = false;
    const stop = async () => {
      if (stopping) return;
      stopping = true;
      await new Promise(resolve => server.close(resolve));
      if (database) await database.stop();
    };
    process.on('SIGINT', () => stop().then(() => process.exit()));
    process.on('SIGTERM', () => stop().then(() => process.exit()));
  })().catch(error => {
    console.error(`Server could not start: ${error.message}`);
    process.exitCode = 1;
  });
}
