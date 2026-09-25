const { createPool } = require('./db');
const { createApp } = require('./app');
let app;
function getApp() {
  if (!app) {
    const port = process.env.PORT || '3000';
    const origins = [process.env.APP_ORIGIN, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`, process.env.VERCEL_BRANCH_URL && `https://${process.env.VERCEL_BRANCH_URL}`].filter(Boolean);
    if (!origins.length && !process.env.VERCEL) origins.push(`http://localhost:${port}`);
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
  require('../scripts/build').build();
  getApp().listen(process.env.PORT || 3000, () => console.log(`Squishies: http://localhost:${process.env.PORT || 3000}`));
}
