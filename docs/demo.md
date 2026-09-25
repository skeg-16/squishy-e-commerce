# Presentation walkthrough

Use fictional names, `@example.test` email addresses, and test addresses. Payment choices are simulations; no real wallet, card, or OTP information is requested.

## Start

```sh
npm ci
npm run demo:local
```

Open http://localhost:3000. Use a fresh browser profile for a fresh guest. The seed creates six individual products with 100 units each, four fixed packs, and WELCOME10, FREESHIP, SQUISHY50. Re-running the seed preserves current stock and orders.

## Five-minute walkthrough

1. **Preserved storefront.** Browse the original home/shop/product pages. Explain that displayed inventory and prices now come from PostgreSQL. Add the Trio, then choose FREESHIP at checkout: ₱249 merchandise, ₱0 shipping, ₱249 total.
2. **Persisted COD order.** Place the order. Refresh the receipt to show persistence. Open its exact link in a private browser: access is denied without the owning guest cookie.
3. **Cancellation.** Cancel that COD order and refresh again. Show the saved cancellation state. The three component stocks are restored once.
4. **Payment failure and retry.** Buy a single product with GCash/Maya/card. Open Pay / retry simulation. Simulate decline, then retry with success. No real payment information is needed, and stock is not deducted twice.
5. **Fulfillment and verified review.** Copy the prepaid order reference. In another terminal, advance the same order:

```sh
node --env-file=.local/demo.env scripts/demo.js SQ-YOUR-REFERENCE Shipped
node --env-file=.local/demo.env scripts/demo.js SQ-YOUR-REFERENCE Completed
```

For a cloud database configured in `.env`, use:

```sh
npm run demo:advance -- SQ-YOUR-REFERENCE Shipped
npm run demo:advance -- SQ-YOUR-REFERENCE Completed
```

Refresh status in the receipt. The event history now contains actual demo shipment/delivery transitions. Submit a review, then visit the product page to see its derived rating. A review before completion or for an unpurchased product is rejected.

## Demonstrate reliability with automated fixtures

```sh
npm test
npm run test:browser
```

These commands create and discard separate databases. They demonstrate:

- Two buyers competing for one item: exactly one order succeeds.
- Repeated Place Order requests: one order and one stock deduction.
- Database write failure: full rollback, preserving stock and quote usability.
- Payment failure/duplicate events: consistent payment state and no duplicate stock movement.
- Expiration and cancellation in either sequence: inventory restored once.
- COD orders do not release stock after 15 minutes.
- Fixed bundle quantities and standalone products share the same component inventory.
- A checkout response lost after commit: the browser retries the original key and recovers one saved order.
- HTML-looking review text displays literally rather than executing.

The live preview uses a real 15-minute hold. Tests set the timestamp in their disposable database to demonstrate expiry immediately; there is no public endpoint that edits deadlines.

## Frontend acceptance checks

At desktop and 390px mobile widths: browse, search/filter, open/close the cart, adjust quantity, check out, retry payment, refresh receipt, and submit a verified review. Use Tab/Escape in cart and payment dialogs. Inspect long order references and multi-event receipts for horizontal overflow.

For an API outage, checkout must show an error and keep the cart. An unconfirmed checkout freezes its request and retries the same key. Never tell the audience a payment, shipment, or deployment is real: these are explicit school-demo scenarios.
