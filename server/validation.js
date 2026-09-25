const { z } = require('zod');
const { fail } = require('./errors');
const region = z.enum(['metro-manila', 'luzon', 'visayas', 'mindanao']);
const slug = z.string().regex(/^[a-z][a-z0-9-]{0,59}$/);
const text = (min, max) => z.string().trim().min(min).max(max);
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
  key: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/), uuid: z.uuid()
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
