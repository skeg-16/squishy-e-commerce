const singles = require('./catalog.json');
const { transaction } = require('./db');
const bundles = [
  { slug: 'solo-squish', name: 'Solo Squish', priceMinor: 8900, components: { dumpling: 1 }, image: 'assets/images/product-dumpling.svg' },
  { slug: 'stress-free-trio', name: 'Stress-Free Trio', priceMinor: 24900, components: { dumpling: 1, catpaw: 1, peanut: 1 }, image: 'assets/images/product-catpaw.svg' },
  { slug: 'collectors-box', name: "Collector's Box", priceMinor: 45900, components: { dumpling: 1, catpaw: 1, peanut: 1, cheese: 1, toast: 1, butter: 1 }, image: 'assets/images/hero-collage.svg' },
  { slug: 'party-pack', name: 'Wholesale / Party Pack', priceMinor: 140000, components: { dumpling: 4, catpaw: 4, peanut: 3, cheese: 3, toast: 3, butter: 3 }, image: 'assets/images/product-peanut.svg' }
];
async function seed(pool) {
  return transaction(pool, async q => {
    // Repeatable and non-destructive: seeding never replenishes sold stock or erases orders.
    for (const product of [...singles, ...bundles]) {
      const { slug, name, priceMinor, stock = 0, kind = 'bundle', components, ...content } = product;
      await q.query('INSERT INTO products(slug,name,kind,price_minor,stock,content) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(slug) DO NOTHING', [slug, name, kind, priceMinor, stock, content]);
      if (components) for (const [component, quantity] of Object.entries(components)) {
        await q.query('INSERT INTO bundle_components(bundle_slug,product_slug,quantity) VALUES($1,$2,$3) ON CONFLICT DO NOTHING', [slug, component, quantity]);
      }
    }
    const vouchers = [
      ['WELCOME10', 'percentage', 10, 15000, '10% welcome discount on merchandise (minimum ₱150)'],
      ['FREESHIP', 'free_shipping', 0, 0, 'Waive the shipping fee once'],
      ['SQUISHY50', 'fixed_amount', 5000, 30000, '₱50 off merchandise (minimum ₱300)']
    ];
    for (const v of vouchers) await q.query('INSERT INTO vouchers(code,type,value,min_spend_minor,description) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING', v);
  });
}
module.exports = { seed, bundles };
