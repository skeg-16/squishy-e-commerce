const { mkdtemp, rm, mkdir, access } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { execSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
function isListening(port, host = '127.0.0.1') {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
  });
}
async function embedded({ directory, port, password, persistent = false } = {}) {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  const base = directory || await mkdtemp(path.join(tmpdir(), 'squishies-pg-'));
  await mkdir(base, { recursive: true });
  port ||= await freePort();
  password ||= randomBytes(24).toString('hex');
  const name = persistent ? 'squishies_demo' : 'squishies_test';
  if (persistent && await isListening(port)) {
    const client = new Client({ connectionString: `postgresql://postgres:${password}@127.0.0.1:${port}/postgres` });
    await client.connect();
    try {
      const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
      if (!rowCount) await client.query(`CREATE DATABASE ${name}`);
    } finally { await client.end(); }
    return { url: `postgresql://postgres:${password}@127.0.0.1:${port}/${name}`, stop: async () => {} };
  }
  const db = new EmbeddedPostgres({ databaseDir: path.join(base, 'data'), user: 'postgres', password,
    port, persistent: true, authMethod: 'scram-sha-256',
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1', ...(process.platform !== 'win32' ? ['-c', `unix_socket_directories=${base}`] : [])],
    onLog: () => {}, onError: () => {} });
  let initialized = false;
  try { await access(path.join(base, 'data/PG_VERSION')); initialized = true; } catch { /* New cluster. */ }
  if (!initialized) {
    await db.initialise();
  } else if (persistent) {
    await db.stop().catch(() => {});
    if (process.platform === 'win32' && !(await isListening(port))) {
      try { execSync('taskkill /F /IM postgres.exe /T', { stdio: 'ignore' }); } catch { /* No orphaned postgres */ }
    }
    await rm(path.join(base, 'data/postmaster.pid'), { force: true });
  }
  await db.start();
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
