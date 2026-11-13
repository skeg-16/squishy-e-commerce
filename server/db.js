const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

function resolveConnectionString(explicitUrl) {
  if (explicitUrl && !explicitUrl.includes('USER:PASSWORD@HOST')) {
    return explicitUrl;
  }
  const envUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL;
  if (envUrl && !envUrl.includes('USER:PASSWORD@HOST')) {
    return envUrl;
  }
  const demoEnvPath = path.join(__dirname, '../.local/demo.env');
  try {
    const content = fs.readFileSync(demoEnvPath, 'utf8');
    const match = content.match(/^DATABASE_URL=(.+)$/m);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch {
    // No .local/demo.env file yet.
  }
  return '';
}

function isLocalDatabaseHost(connectionString) {
  try {
    const parsed = new URL(connectionString);
    return ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  } catch {
    return true;
  }
}

function redactDatabaseUrl(connectionString) {
  try {
    const parsed = new URL(connectionString);
    if (parsed.password) {
      parsed.password = '****';
    }
    return parsed.toString();
  } catch {
    return 'postgresql://****';
  }
}

function createPool(connectionString) {
  const resolved = resolveConnectionString(connectionString);
  if (!resolved) {
    throw new Error('DATABASE_URL is required. See .env.example or run npm run demo:local.');
  }

  const isLocal = isLocalDatabaseHost(resolved);
  const useSsl =
    process.env.DATABASE_SSL === 'require' ||
    process.env.DATABASE_SSL === 'true' ||
    (!isLocal && process.env.DATABASE_SSL !== 'false' && process.env.NODE_ENV === 'production');

  const pool = new Pool({
    connectionString: resolved,
    max: Math.min(Math.max(Number(process.env.PG_POOL_MAX) || 10, 2), 50),
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
    query_timeout: 15000,
    idle_in_transaction_session_timeout: 15000,
    application_name: 'squishies-commerce-api',
    ...(useSsl
      ? {
          ssl: {
            rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
          },
        }
      : {}),
  });

  pool.on('error', () => {
    console.error(JSON.stringify({ event: 'database_connection_error' }));
  });

  return pool;
}

async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query("SET LOCAL statement_timeout = '15s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function checkDatabaseHealth(pool) {
  const startedAt = Date.now();
  await pool.query('SELECT 1');
  const latencyMs = Date.now() - startedAt;
  return {
    connected: true,
    latencyMs,
    pool: {
      total: pool.totalCount ?? 0,
      idle: pool.idleCount ?? 0,
      waiting: pool.waitingCount ?? 0,
    },
  };
}

async function pruneExpiredRecords(pool) {
  await pool.query("DELETE FROM rate_limits WHERE expires_at < clock_timestamp() - interval '1 hour'");
  await pool.query('DELETE FROM user_sessions WHERE expires_at <= clock_timestamp()');
  await pool.query('DELETE FROM admin_sessions WHERE expires_at <= clock_timestamp()');
}

module.exports = {
  createPool,
  transaction,
  resolveConnectionString,
  redactDatabaseUrl,
  checkDatabaseHealth,
  pruneExpiredRecords,
};
