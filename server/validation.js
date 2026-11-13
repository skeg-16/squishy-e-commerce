const { z } = require('zod');
const { fail } = require('./errors');

const region = z.enum(['metro-manila', 'luzon', 'visayas', 'mindanao']);
const slug = z.string().trim().regex(/^[a-z][a-z0-9-]{0,59}$/, {
  error: 'Slug must start with a lowercase letter and use only lowercase letters, numbers, and hyphens.',
});
const text = (min, max) => z.string().trim().min(min).max(max);

const personName = z
  .string()
  .trim()
  .min(2, { error: 'Full name must be at least 2 characters.' })
  .max(60, { error: 'Full name cannot exceed 60 characters.' })
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,59}$/u, {
    error: 'Use letters only (no numbers or special characters).',
  });

const phMobile = z
  .string()
  .trim()
  .regex(/^09\d{9}$/, {
    error: 'Contact number must be strictly 11 digits starting with 09 (numbers only).',
  });

const phPostalCode = z
  .string()
  .trim()
  .regex(/^\d{4}$/, {
    error: 'ZIP / Postal Code must be strictly 4 digits (numbers only).',
  })
  .refine((v) => v !== '0000', {
    error: 'Enter a valid 4-digit Philippine postal code.',
  });

const cityName = z
  .string()
  .trim()
  .min(2, { error: 'Enter your city or municipality.' })
  .max(50, { error: 'City / Municipality cannot exceed 50 characters.' })
  .regex(/^[\p{L}\p{M}][\p{L}\p{M} .'-]{1,49}$/u, {
    error: 'City / Municipality must contain letters only.',
  });

const barangayName = z
  .string()
  .trim()
  .min(2, { error: 'Enter your barangay.' })
  .max(50, { error: 'Barangay cannot exceed 50 characters.' })
  .regex(/^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .,'()#/-]{1,49}$/u, {
    error: 'Enter a valid barangay name or number.',
  });

const usernameSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_]{3,28}$/, {
    error: 'Username must be 3–28 characters using letters, numbers, or underscores only.',
  });

const emailSchema = z
  .email({ error: 'Enter a valid email address (e.g. name@example.com).' })
  .max(80, { error: 'Email address cannot exceed 80 characters.' })
  .transform((v) => v.toLowerCase());

const birthdaySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Enter a valid date in YYYY-MM-DD format.' })
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime())) return false;
    if (parsed.toISOString().slice(0, 10) !== value) return false;
    const now = new Date();
    const minDate = new Date('1900-01-01T00:00:00Z');
    return parsed >= minDate && parsed <= now;
  }, { error: 'Birthday cannot be in the future.' });

const passwordSchema = z
  .string()
  .min(8, { error: 'Password must be at least 8 characters.' })
  .max(72, { error: 'Password cannot exceed 72 characters.' })
  .regex(/[A-Za-z]/, { error: 'Password must contain at least one letter.' })
  .regex(/\d/, { error: 'Password must contain at least one number.' });

const defaultAddressSchema = z.strictObject({
  recipientName: personName.optional().or(z.literal('')),
  phone: phMobile.optional().or(z.literal('')),
  shippingAddress: text(5, 100),
  city: cityName,
  barangay: barangayName,
  postalCode: phPostalCode,
  region,
});

const voucherCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{3,30}$/, {
    error: 'Voucher code must be 3–30 characters using letters, numbers, hyphens, or underscores.',
  })
  .transform((v) => v.toUpperCase());

const imagePathSchema = z
  .string()
  .trim()
  .min(1, { error: 'Image path is required.' })
  .max(300, { error: 'Image path is too long.' })
  .refine((v) => !/^(javascript|data|vbscript):/i.test(v), {
    error: 'Enter a valid image path.',
  });

const bundleComponentSchema = z.strictObject({
  slug,
  quantity: z.number().int().min(1).max(99),
});

function validateVoucherDiscount(data, ctx) {
  if (data.type === 'percentage') {
    if (!Number.isInteger(data.value) || data.value < 1 || data.value > 100) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Percentage discount must be a whole number between 1 and 100.',
      });
    }
  } else if (data.type === 'fixed_amount') {
    if (data.value <= 0 || data.value > 100000) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Fixed peso discount must be greater than ₱0.',
      });
    }
  }
}

const schemas = {
  quote: z.strictObject({
    items: z.array(z.strictObject({ slug, quantity: z.number().int().min(1).max(99) })).min(1).max(20),
    region,
    voucherCode: z.string().trim().max(30).transform((v) => v.toUpperCase()).optional().default(''),
  }),
  order: z.strictObject({
    quoteId: z.uuid(),
    customerName: personName,
    customerEmail: emailSchema,
    customerPhone: phMobile,
    shippingAddress: text(5, 100),
    city: cityName,
    barangay: barangayName,
    postalCode: phPostalCode,
    paymentMethod: z.enum(['cod', 'gcash', 'maya', 'card']),
    orderNote: z.string().trim().max(200).optional(),
  }),
  cancel: z.strictObject({ reason: text(3, 300) }),
  payment: z.strictObject({ orderNumber: text(1, 60) }),
  outcome: z.strictObject({
    outcome: z.enum(['success', 'declined', 'cancelled']),
    payerMobile: phMobile.optional(),
    otpCode: z.string().trim().regex(/^\d{6}$/, { error: 'OTP must be strictly 6 digits.' }).optional(),
    mpin: z.string().trim().regex(/^\d{4}$/, { error: 'MPIN must be strictly 4 digits.' }).optional(),
    cardLast4: z.string().trim().regex(/^\d{4}$/, { error: 'Card last 4 digits must be numeric.' }).optional(),
  }),
  deliveryStage: z.strictObject({
    stage: z.enum(['shipped', 'out_for_delivery', 'completed']),
  }),
  review: z.strictObject({
    orderNumber: text(1, 60),
    productSlug: slug,
    rating: z.number().int().min(1).max(5),
    comment: text(3, 1000),
    reviewerName: text(1, 60),
  }),
  key: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
  uuid: z.uuid(),
  slug,
  voucherCode: voucherCodeSchema,

  // Auth & Customer Account Schemas
  register: z
    .strictObject({
      username: usernameSchema,
      email: emailSchema,
      phone: phMobile,
      birthday: birthdaySchema,
      password: passwordSchema,
      confirmPassword: z.string().min(1),
    })
    .refine((d) => d.password === d.confirmPassword, {
      path: ['confirmPassword'],
      error: 'Passwords do not match.',
    }),
  login: z.strictObject({
    identifier: text(3, 254),
    password: z.string().min(1, { error: 'Enter your password.' }).max(72),
  }),
  resetPassword: z
    .strictObject({
      username: usernameSchema,
      email: emailSchema,
      birthday: birthdaySchema,
      newPassword: passwordSchema,
      confirmPassword: z.string().min(1),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      path: ['confirmPassword'],
      error: 'New passwords do not match.',
    }),
  updateProfile: z.strictObject({
    username: usernameSchema,
    email: emailSchema,
    phone: phMobile,
    birthday: birthdaySchema,
    defaultAddress: defaultAddressSchema.nullable().optional(),
  }),
  changePassword: z
    .strictObject({
      currentPassword: z.string().min(1, { error: 'Current password is required.' }).max(72),
      newPassword: passwordSchema,
      confirmPassword: z.string().min(1),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      path: ['confirmPassword'],
      error: 'New passwords do not match.',
    }),
  deleteAccount: z.strictObject({
    password: z.string().min(1, { error: 'Enter your password to confirm.' }).max(72),
    confirmation: z.literal('DELETE', { error: 'Type DELETE exactly to confirm.' }),
  }),

  // Admin Schemas
  adminLogin: z.strictObject({
    identifier: z.string().trim().max(254).optional(),
    password: z.string().min(1, { error: 'Enter your admin password.' }).max(128),
  }),
  adminOrderAction: z.strictObject({
    action: z.enum(['ship', 'out_for_delivery', 'complete', 'cancel']),
    reason: z.string().trim().min(2).max(300).optional(),
  }),
  adminStock: z.strictObject({
    stock: z
      .number({ error: 'Stock must be a valid number.' })
      .int({ error: 'Stock must be a whole number.' })
      .min(0, { error: 'Stock cannot be negative.' })
      .max(100000, { error: 'Stock cannot exceed 100,000.' }),
  }),
  adminProductCreate: z.strictObject({
    slug,
    name: text(2, 100),
    kind: z.enum(['single', 'bundle']),
    price: z.number({ error: 'Enter a valid price.' }).min(0, { error: 'Price cannot be negative.' }).max(1000000),
    stock: z.number().int().min(0).max(100000).optional(),
    components: z.array(bundleComponentSchema).min(1, { error: 'Add at least one product to the bundle.' }).max(30).optional(),
    active: z.boolean().optional().default(true),
    description: z.string().trim().max(1000).optional().default(''),
    badge: z.string().trim().max(30).optional().default(''),
    badgeClass: z.enum(['', 'badge--pink', 'badge--purple', 'badge--mint', 'badge--peach']).optional().default(''),
    image: imagePathSchema,
    specs: z.record(z.string().trim().min(1).max(60), z.string().trim().min(1).max(300)).optional().default({}),
    category: z.string().trim().max(40).optional(),
  }),
  adminProductUpdate: z.strictObject({
    slug: slug.optional(),
    kind: z.enum(['single', 'bundle']).optional(),
    name: text(2, 100),
    price: z.number({ error: 'Enter a valid price.' }).min(0, { error: 'Price cannot be negative.' }).max(1000000),
    stock: z.number().int().min(0).max(100000).optional(),
    components: z.array(bundleComponentSchema).min(1, { error: 'Add at least one product to the bundle.' }).max(30).optional(),
    active: z.boolean().optional().default(true),
    description: z.string().trim().max(1000).optional().default(''),
    badge: z.string().trim().max(30).optional().default(''),
    badgeClass: z.enum(['', 'badge--pink', 'badge--purple', 'badge--mint', 'badge--peach']).optional().default(''),
    image: imagePathSchema,
    specs: z.record(z.string().trim().min(1).max(60), z.string().trim().min(1).max(300)).optional().default({}),
    category: z.string().trim().max(40).optional(),
  }),
  adminVoucherCreate: z
    .strictObject({
      code: voucherCodeSchema,
      type: z.enum(['percentage', 'fixed_amount', 'free_shipping']),
      value: z.number({ error: 'Enter a valid discount value.' }).min(0).max(100000),
      minSpend: z.number({ error: 'Enter a valid minimum spend.' }).min(0).max(1000000).optional().default(0),
      description: text(3, 200),
      active: z.boolean().optional().default(true),
    })
    .superRefine(validateVoucherDiscount),
  adminVoucherUpdate: z
    .strictObject({
      code: voucherCodeSchema.optional(),
      type: z.enum(['percentage', 'fixed_amount', 'free_shipping']),
      value: z.number({ error: 'Enter a valid discount value.' }).min(0).max(100000),
      minSpend: z.number({ error: 'Enter a valid minimum spend.' }).min(0).max(1000000).optional().default(0),
      description: text(3, 200),
      active: z.boolean().optional().default(true),
    })
    .superRefine(validateVoucherDiscount),
  adminUserCreate: z.strictObject({
    username: usernameSchema,
    fullName: personName.optional(),
    email: emailSchema,
    phone: phMobile,
    birthday: birthdaySchema.optional().default('2000-01-01'),
    password: passwordSchema,
    role: z.enum(['customer', 'admin']).optional().default('customer'),
    active: z.boolean().optional().default(true),
  }),
  adminUserUpdate: z.strictObject({
    username: usernameSchema.optional(),
    fullName: personName.optional(),
    email: emailSchema.optional(),
    phone: phMobile.optional().or(z.literal('')),
    birthday: birthdaySchema.optional(),
    role: z.enum(['customer', 'admin']).optional(),
    active: z.boolean().optional(),
    defaultAddress: defaultAddressSchema.nullable().optional(),
  }),
  adminUserPasswordReset: z.strictObject({
    newPassword: passwordSchema,
  }),
};

function parse(name, input) {
  const result = schemas[name].safeParse(input);
  if (!result.success) {
    const fields = Object.fromEntries(
      result.error.issues.map((i) => [i.path.join('.') || name, i.message])
    );
    const firstMessage = result.error.issues[0]?.message || 'Please check the submitted details.';
    fail(400, 'VALIDATION_ERROR', firstMessage, fields);
  }
  return result.data;
}

module.exports = { parse };
