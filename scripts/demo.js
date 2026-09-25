const { createPool } = require('../server/db');
const { createCommerce } = require('../server/commerce');
(async () => {
  const [number, status] = process.argv.slice(2);
  if (!number || !['Shipped','Completed'].includes(status)) throw new Error('Usage: npm run demo:advance -- SQ-REFERENCE Shipped|Completed');
  if (process.env.DEMO_MODE !== 'true') throw new Error('Set DEMO_MODE=true for demo orders.');
  const pool = createPool();
  try {
    const order = await createCommerce(pool, { demoMode: true }).advanceDemo(number, status);
    console.log(JSON.stringify({ orderNumber: order.orderNumber, status: order.status, paymentStatus: order.paymentStatus }));
  } finally { await pool.end(); }
})().catch(error => { console.error(error.code ? `${error.code}: ${error.message}` : 'Check DEMO_MODE, DATABASE_URL, order reference, and Shipped|Completed status.'); process.exitCode = 1; });
