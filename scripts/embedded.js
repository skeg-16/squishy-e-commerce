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
  if (persistent && (await isListening(port))) {
    let client;
    let healthy = false;
    try {
      client = new Client({
        connectionString: `postgresql://postgres:${password}@127.0.0.1:${port}/postgres`,
        connectionTimeoutMillis: 2500,
      });
      await client.connect();
      const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
      if (!rowCount) await client.query(`CREATE DATABASE ${name}`);
      healthy = true;
    } catch {
      healthy = false;
    } finally {
      if (client) await client.end().catch(() => {});
    }
    if (healthy) {
      return { url: `postgresql://postgres:${password}@127.0.0.1:${port}/${name}`, stop: async () => {} };
    }
    if (process.platform === 'win32') {
      try {
        execSync('powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = \'postgres.exe\' AND SessionId != 0\\" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"', { stdio: 'ignore' });
      } catch {
        /* No orphaned postgres */
      }
    }
    await rm(path.join(base, 'data/postmaster.pid'), { force: true });
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
    await Promise.race([db.stop().catch(() => {}), new Promise(r => setTimeout(r, 2000))]);
    if (process.platform === 'win32' && !(await isListening(port))) {
      try {
        execSync('powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name = \'postgres.exe\' AND SessionId != 0\\" | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"', { stdio: 'ignore' });
      } catch { /* No orphaned postgres */ }
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
  return {
    url: `postgresql://postgres:${password}@127.0.0.1:${port}/${name}`,
    stop: async () => {
      try {
        await Promise.race([
          db.stop().catch(() => {}),
          new Promise(r => setTimeout(r, 2000)),
        ]);
      } catch {}
      if (process.platform === 'win32' && db.process?.pid) {
        try {
          execSync(`taskkill /F /PID ${db.process.pid} /T`, { stdio: 'ignore' });
        } catch {}
      }
      if (!persistent) {
        await rm(base, { recursive: true, force: true }).catch(() => {});
      }
    },
  };
}
module.exports = { embedded };
