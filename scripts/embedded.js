const { mkdtemp, rm, mkdir, access } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { randomBytes } = require('node:crypto');
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function embedded({ directory, port, password, persistent = false } = {}) {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const base = directory || await mkdtemp(path.join(tmpdir(), 'squishies-pg-'));
  await mkdir(base, { recursive: true });
  port ||= await freePort();
  password ||= randomBytes(24).toString('hex');
  const db = new EmbeddedPostgres({ databaseDir: path.join(base, 'data'), user: 'postgres', password,
    port, persistent: true, authMethod: 'scram-sha-256',
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1', '-c', `unix_socket_directories=${base}`],
    onLog: () => {}, onError: () => {} });
  let initialized = false;
  try { await access(path.join(base, 'data/PG_VERSION')); initialized = true; } catch { /* New cluster. */ }
  if (!initialized) await db.initialise();
  await db.start();
  const name = persistent ? 'squishies_demo' : 'squishies_test';
  const client = db.getPgClient();
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
    if (!rowCount) await db.createDatabase(name);
  } finally { await client.end(); }
  return { url: `postgresql://postgres:${password}@127.0.0.1:${port}/${name}`, stop: async () => {
    await db.stop();
    if (!persistent) await rm(base, { recursive: true, force: true });
  } };
}
module.exports = { embedded };
