const fs = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { embedded } = require('./embedded');
const { migrate } = require('./database');
const { seed } = require('../server/seed');
const {
  createPool,
  resolveConnectionString,
  redactDatabaseUrl,
  checkDatabaseHealth,
} = require('../server/db');

const ALLOWED_TABLES = [
  'products',
  'bundle_components',
  'vouchers',
  'users',
  'orders',
  'order_items',
  'reservations',
  'payment_attempts',
  'order_events',
  'reviews',
  'admin_audit_logs',
  'user_sessions',
  'admin_sessions',
  'guest_sessions',
  'rate_limits',
  'schema_migrations',
];

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

function maskSensitiveRow(row) {
  if (!row || typeof row !== 'object') return row;
  const copy = { ...row };
  if ('password_hash' in copy && copy.password_hash) {
    copy.password_hash = '[REDACTED_SCRYPT_HASH]';
  }
  if ('token_hash' in copy && copy.token_hash) {
    copy.token_hash = `${String(copy.token_hash).slice(0, 10)}…[SHA256]`;
  }
  return copy;
}

async function ensureDatabaseConnection() {
  const existingUrl = resolveConnectionString();
  if (existingUrl) {
    try {
      const parsed = new URL(existingUrl);
      const port = Number(parsed.port || 5432);
      const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
      if (!isLocal || (await isPortListening(port, parsed.hostname))) {
        const pool = createPool(existingUrl);
        await migrate(pool);
        await seed(pool);
        return { pool, url: existingUrl, stop: async () => await pool.end() };
      }
    } catch {
      // Fall back to starting embedded local Postgres below.
    }
  }

  const directory = path.join(__dirname, '../.local');
  await fs.mkdir(directory, { recursive: true });
  const passwordFile = path.join(directory, 'database-password');
  let password;
  try {
    password = (await fs.readFile(passwordFile, 'utf8')).trim();
  } catch {
    password = randomBytes(24).toString('hex');
    await fs.writeFile(passwordFile, password, { mode: 0o600 });
  }

  const wasRunning = await isPortListening(55432, '127.0.0.1');
  const database = await embedded({ directory, port: 55432, password, persistent: true });
  await fs.writeFile(
    path.join(directory, 'demo.env'),
    `DATABASE_URL=${database.url}\nDEMO_MODE=true\n`,
    { mode: 0o600 }
  );
  const pool = createPool(database.url);
  await migrate(pool);
  await seed(pool);

  return {
    pool,
    url: database.url,
    stop: async () => {
      await pool.end();
      if (!wasRunning) {
        await database.stop();
      }
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const tableArg = args.find((a) => a.startsWith('--table='))?.split('=')[1]?.trim();
  const showCredentials = args.includes('--credentials');
  const customQuery = args.find((a) => !a.startsWith('--'));

  const { pool, url, stop } = await ensureDatabaseConnection();
  try {
    const parsedUrl = new URL(url);
    const health = await checkDatabaseHealth(pool);

    console.log('\n====================================================================');
    console.log('  SQUISHIES POSTGRESQL DATABASE INSPECTOR & SECURITY DIAGNOSTICS');
    console.log('====================================================================');
    console.log(`  Status          : CONNECTED (${health.latencyMs}ms latency)`);
    console.log(`  Connection URL  : ${redactDatabaseUrl(url)}`);
    console.log(`  Host / Port     : ${parsedUrl.hostname}:${parsedUrl.port || 5432}`);
    console.log(`  Database Name   : ${parsedUrl.pathname.replace(/^\//, '')}`);
    console.log(`  Username        : ${parsedUrl.username}`);
    console.log(`  Auth & Storage  : SCRAM-SHA-256 | Local Data Dir: .local/data`);
    if (showCredentials) {
      console.log(`  Password        : ${parsedUrl.password}`);
      console.log(`  Full URI        : ${url}`);
    } else {
      console.log('  Tip             : Run `npm run db:inspect -- --credentials` to reveal password for pgAdmin / DBeaver');
    }
    console.log('====================================================================\n');

    if (customQuery) {
      console.log(`Executing SQL Query: ${customQuery}\n`);
      const res = await pool.query(customQuery);
      console.log(`Command: ${res.command} | Rows: ${res.rowCount}`);
      if (res.rows && res.rows.length > 0) {
        console.table(res.rows.map(maskSensitiveRow));
      }
      return;
    }

    if (tableArg) {
      if (!ALLOWED_TABLES.includes(tableArg)) {
        throw new Error(
          `Unknown table "${tableArg}". Allowed tables: ${ALLOWED_TABLES.join(', ')}`
        );
      }
      const { rows } = await pool.query(`SELECT * FROM ${tableArg} LIMIT 100`);
      console.log(`Table: ${tableArg} (showing up to 100 rows, total returned: ${rows.length})`);
      if (rows.length === 0) {
        console.log('  (No rows in this table yet)');
      } else {
        console.table(rows.map(maskSensitiveRow));
      }
      return;
    }

    // 1. Table overview & row counts
    const overviewRows = [];
    for (const table of ALLOWED_TABLES) {
      const { rows: [c] } = await pool.query(`SELECT count(*)::int AS count FROM ${table}`);
      overviewRows.push({ table_name: table, row_count: c.count });
    }
    console.log('1. DATABASE TABLES & ROW COUNTS');
    console.table(overviewRows);

    // 2. Products & Inventory
    const { rows: products } = await pool.query(
      `SELECT slug, name, kind, ROUND(price_minor / 100.0, 2) AS price_php, stock, active
       FROM products
       ORDER BY kind ASC, slug ASC`
    );
    console.log('\n2. PRODUCTS & INVENTORY (products)');
    console.table(products);

    // 3. Vouchers
    const { rows: vouchers } = await pool.query(
      `SELECT code, type, value, ROUND(min_spend_minor / 100.0, 2) AS min_spend_php, active, description
       FROM vouchers
       ORDER BY code ASC`
    );
    console.log('\n3. PROMO VOUCHERS (vouchers)');
    console.table(vouchers);

    // 4. Registered Users (Password hashes redacted)
    const { rows: users } = await pool.query(
      `SELECT id, username, email, phone, role, active, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 20`
    );
    console.log('\n4. REGISTERED USERS (users — password hashes hidden)');
    if (users.length === 0) {
      console.log('  (No registered users yet — register on /account or create via /admin)');
    } else {
      console.table(users);
    }

    // 5. Recent Orders
    const { rows: orders } = await pool.query(
      `SELECT order_number, status, payment_method, payment_status,
              ROUND(COALESCE((pricing->>'totalMinor')::numeric, 0) / 100.0, 2) AS total_php,
              customer->>'customerName' AS customer_name,
              created_at
       FROM orders
       ORDER BY created_at DESC
       LIMIT 15`
    );
    console.log('\n5. RECENT ORDERS (orders)');
    if (orders.length === 0) {
      console.log('  (No orders placed yet)');
    } else {
      console.table(orders);
    }

    // 6. Recent Admin Audit Logs
    const { rows: logs } = await pool.query(
      `SELECT id, actor, action, target_type, target_id, created_at
       FROM admin_audit_logs
       ORDER BY created_at DESC
       LIMIT 10`
    );
    console.log('\n6. RECENT ADMIN AUDIT LOGS (admin_audit_logs)');
    if (logs.length === 0) {
      console.log('  (No admin audit logs recorded yet)');
    } else {
      console.table(logs);
    }
  } finally {
    await stop();
  }
}

main().catch((err) => {
  console.error(`Database inspection failed: ${err?.message || String(err || 'Could not start or connect to PostgreSQL')}`);
  process.exitCode = 1;
});

