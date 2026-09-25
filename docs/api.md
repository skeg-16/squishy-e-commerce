# API contract

All URLs are relative to the storefront origin. Responses use `{ "success": true, "data": ... }` or `{ "success": false, "error": "Readable message", "code": "MACHINE_CODE", "fields": {}, "requestId": "..." }`. `fields` is included only for field validation errors.

Mutations require `Content-Type: application/json` and an `Origin` equal to the configured storefront. Browsers supply Origin automatically. Non-browser examples must supply it explicitly. Cross-origin requests are rejected; there is no wildcard CORS.

## Session and ownership

`POST /api/session` with `{}` creates or reuses the guest's HttpOnly, SameSite=Strict cookie. HTTPS deployments also set Secure. The server stores a SHA-256 hash, never the raw cookie value. Call this once before protected endpoints. Do not build authentication from order numbers or email addresses.

Local curl setup:

```sh
curl -c /tmp/squishies-demo-cookies -H 'Origin: http://localhost:3000' \
  -H 'Content-Type: application/json' -d '{}' http://localhost:3000/api/session
```

Use `-b /tmp/squishies-demo-cookies` for later protected requests. This is a local demo cookie file; remove it after the demonstration.

## Routes

| Method / route | Input / behavior | Ownership |
|---|---|---|
| GET `/api/health` | Database readiness and demo-mode flag; 503 on failure | Public |
| GET `/api/products` | Complete active catalog | Public |
| GET `/api/products/:slug` | Product detail or 404 | Public |
| GET `/api/vouchers/available` | Codes, types, descriptions | Public |
| POST `/api/checkout/quote` | Items, region, optional voucher; returns persisted five-minute quote | Guest |
| POST `/api/orders` | Quote ID, customer fields, payment method; requires Idempotency-Key | Guest |
| GET `/api/orders/:number` | Persisted receipt, permitted actions, and event history | Owner |
| POST `/api/orders/:number/cancel` | `{ "reason": "Change of mind" }`; repeat cancellation is harmless | Owner |
| POST `/api/payments/sessions` | `{ "orderNumber": "SQ-..." }`; requires Idempotency-Key | Owner; demo mode |
| POST `/api/payments/sessions/:id/simulate` | `{ "outcome": "success" }`; also `declined`, `cancelled` | Owner; demo mode |
| GET `/api/tracking/:number` | Actual stored events for a `DEMO-...` reference | Owner |
| GET `/api/reviews/:slug` | Aggregate rating/count and latest 100 reviews, without private order IDs | Public |
| POST `/api/reviews` | Order, product, rating, comment, public display name | Owner of completed purchase |

Removed routes return 404: `/api/payments/confirm`, `/api/payments/webhook`, `/api/payments/create-checkout-session`, and `/api/vouchers/apply`. Voucher application now obtains a complete server-priced quote; browser subtotals are never trusted.

## Quote and order example

```json
{
  "items": [{ "slug": "dumpling", "quantity": 2 }],
  "region": "metro-manila",
  "voucherCode": "FREESHIP"
}
```

Send to `POST /api/checkout/quote`. Items are strictly `{slug, quantity}`: 1–20 lines, positive integer quantities, at most 99 per product after duplicate lines are combined. Unknown fields such as `price` are rejected. Region must be `metro-manila`, `luzon`, `visayas`, or `mindanao`.

The response includes `quoteId`, `expiresAt`, `items`, `subtotal`, `shippingFee`, `voucherDiscount`, `shippingDiscount`, `total`, `currency`, `delivery`, `demoMode`, and `paymentMethods`. All public money fields are in pesos; authoritative calculations and stored line prices use integer centavos. `voucherDiscount` reduces merchandise. `shippingDiscount` is informational savings already reflected in `shippingFee`; never subtract it again. This example totals ₱178.

Use the returned quote ID:

```json
{
  "quoteId": "UUID_FROM_QUOTE",
  "customerName": "Demo Buyer",
  "customerEmail": "buyer@example.test",
  "customerPhone": "09171234567",
  "shippingAddress": "123 Test Street",
  "city": "Manila",
  "barangay": "Ermita",
  "postalCode": "1000",
  "paymentMethod": "cod"
}
```

Send to `POST /api/orders` with `Idempotency-Key: <crypto.randomUUID()>`. The server reads the region, items, and voucher from the guest-owned quote. It does not accept client prices or totals.

A quote can create only one order. Keys are scoped to the guest and bound to the parsed order payload. Retrying the same key/payload returns that order; a different payload with the same key returns 409. A different key cannot reuse a consumed quote.

On uncertain network errors or 5xx, retry the **same payload and key**. The storefront keeps that pending payload in tab-scoped sessionStorage until confirmed; it never stores payment credentials. Do not silently create a new quote and order when the original result is unknown. On PRICE_CHANGED or QUOTE_EXPIRED, obtain and display a new quote, then require a second Place Order click.

## Payment and lifecycle

Electronic methods (`gcash`, `maya`, `card`) are available only with `DEMO_MODE=true`. COD remains available without it. Payment amounts and methods come from the order, not the client.

Session creation is idempotent per order/key and returns any existing pending session. A declined/cancelled attempt ends that attempt, leaving the order payable until its 15-minute deadline. Retry with a new session key. A repeated identical terminal outcome is harmless; changing a terminal outcome returns 409. A late success cannot resurrect an expired or cancelled order. No real card data, OTPs, or wallet credentials are accepted.

Order responses include `status`, `paymentStatus`, `canPay`, `canCancel`, `expiresAt`, item snapshots, customer/address fields, and chronological events. Reload these fields from the server rather than deriving order state in the browser.

Review body:

```json
{
  "orderNumber": "SQ-REFERENCE",
  "productSlug": "dumpling",
  "rating": 5,
  "comment": "A successful demonstration purchase.",
  "reviewerName": "Demo Buyer"
}
```

Reviews require completion and either a purchased SKU or a component of a purchased bundle. One review per order/product. The public display name is explicit; customer contact information is not published. Treat all review text as plain text in the UI.

## Errors and limits

- 400: validation, unknown product, invalid voucher, disabled payment method.
- 401: missing/expired guest session.
- 403: untrusted or missing mutation Origin.
- 404: missing or unowned resource; disabled simulation route.
- 409: unavailable stock, expired/changed/used quote, conflicting retry, invalid lifecycle state, duplicate review.
- 413 / 415: body above 32 KiB / unsupported content type.
- 429: shared database-backed limit of 120 API requests/minute per IP; `Retry-After: 60`.
- 503: dependency or transaction failure. No success is returned; retry with the original idempotency key.

Logs contain request IDs and error categories, never submitted customer/payment payloads. API responses are `Cache-Control: no-store`.
