const fs = require('node:fs/promises');
const path = require('node:path');
const { createPool, transaction } = require('../server/db');
const { seed } = require('../server/seed');
async function migrate(pool) {
  await transaction(pool, async q => {
    await q.query('SELECT pg_advisory_xact_lock(83171429)');
    await q.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())');
    const directory = path.join(__dirname, '../server/migrations');
    for (const version of (await fs.readdir(directory)).filter(n => n.endsWith('.sql')).sort()) {
      const { rowCount } = await q.query('SELECT 1 FROM schema_migrations WHERE version=$1', [version]);
      if (rowCount) continue;
      await q.query(await fs.readFile(path.join(directory, version), 'utf8'));
      await q.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
    }
  });
}
if (require.main === module) {
  (async () => {
    const action = process.argv[2];
    if (!['migrate', 'seed'].includes(action)) throw new Error('Use migrate or seed.');
    const pool = createPool();
    try { await (action === 'migrate' ? migrate(pool) : seed(pool)); console.log(`Database ${action} completed.`); }
    finally { await pool.end(); }
  })().catch(() => { console.error('Database operation failed. Check DATABASE_URL and run migrations before seeding.'); process.exitCode = 1; });
}
module.exports = { migrate };
