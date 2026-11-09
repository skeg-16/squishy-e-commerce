const { z } = require('zod');
const { fail } = require('./errors');
const region = z.enum(['metro-manila', 'luzon', 'visayas', 'mindanao']);
const slug = z.string().regex(/^[a-z][a-z0-9-]{0,59}$/);
const text = (min, max) => z.string().trim().min(min).max(max);
const pesos = z.number().min(0).max(1000000);
function productFields() {
  return {
    name: text(2, 100), price: pesos, stock: z.number().int().min(0).max(100000).default(0), active: z.boolean(),
    description: z.string().trim().max(1000).default(''), badge: z.string().trim().max(30).default(''),
    badgeClass: z.enum(['', 'badge--pink', 'badge--purple', 'badge--mint', 'badge--peach']).default(''),
    image: z.string().trim().regex(/^assets\/images\/[A-Za-z0-9._-]+\.(svg|png|jpe?g|webp)$/, 'Use a path like assets/images/product-dumpling.svg'),
    specs: z.record(z.string().trim().min(1).max(60), z.string().trim().max(300)).refine(o => Object.keys(o).length <= 20, 'At most 20 spec lines.').default({}),
    components: z.array(z.strictObject({ slug, quantity: z.number().int().min(1).max(99) })).max(20).default([])
  };
}
function voucherFields() {
  return {
    type: z.enum(['percentage', 'fixed_amount', 'free_shipping']), value: z.number().min(0).max(1000000).default(0),
    minSpend: pesos.default(0), description: text(3, 200), active: z.boolean()
  };
}
const schemas = {
  quote: z.strictObject({
    items: z.array(z.strictObject({ slug, quantity: z.number().int().min(1).max(99) })).min(1).max(20),
    region, voucherCode: z.string().trim().max(30).transform(v => v.toUpperCase()).optional().default('')
  }),
  order: z.strictObject({
    quoteId: z.uuid(), customerName: text(3, 100), customerEmail: z.email().max(254),
    customerPhone: z.string().transform(v => v.replace(/[\s-]/g, '')).pipe(z.string().regex(/^09\d{9}$/)),
    shippingAddress: text(5, 200), city: text(2, 100), barangay: text(2, 100),
    postalCode: z.string().regex(/^\d{4}$/), paymentMethod: z.enum(['cod', 'gcash', 'maya', 'card'])
  }),
  cancel: z.strictObject({ reason: text(3, 300) }),
  payment: z.strictObject({ orderNumber: text(1, 60) }),
  outcome: z.strictObject({ outcome: z.enum(['success', 'declined', 'cancelled']) }),
  review: z.strictObject({ orderNumber: text(1, 60), productSlug: slug, rating: z.number().int().min(1).max(5), comment: text(3, 1000), reviewerName: text(1, 60) }),
  key: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/), uuid: z.uuid(),
  // ---- admin
  adminLogin: z.strictObject({ password: z.string().min(1).max(200) }),
  slug,
  orderNumber: text(1, 60),
  adminProduct: z.strictObject(productFields()),
  adminProductCreate: z.strictObject({ slug, kind: z.enum(['single', 'bundle']), ...productFields() }),
  adminStock: z.strictObject({ stock: z.number().int().min(0).max(100000) }),
  adminVoucher: z.strictObject(voucherFields()),
  adminVoucherCreate: z.strictObject({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, 'Use 3-30 letters, numbers, dashes or underscores.'), ...voucherFields() }),
  voucherCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/),
  adminOrderAction: z.strictObject({ action: z.enum(['ship', 'complete', 'cancel']), reason: z.string().trim().max(300).optional() })
};
function parse(name, input) {
  const result = schemas[name].safeParse(input);
  if (!result.success) {
    const fields = Object.fromEntries(result.error.issues.map(i => [i.path.join('.') || name, i.message]));
    fail(400, 'VALIDATION_ERROR', 'Please check the submitted details.', fields);
  }
  return result.data;
}
module.exports = { parse };
