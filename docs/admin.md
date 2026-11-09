# Admin dashboard

A small, single-page admin at **`/admin.html`** for running the shop day to day. No extra tables or migrations are needed.

## Setup

Set a password of at least 8 characters, then start the server:

```sh
# .env (never commit this)
ADMIN_PASSWORD=choose-something-long
# optional: signing key for session cookies; defaults to one derived from ADMIN_PASSWORD
ADMIN_SESSION_SECRET=
```

- `npm run demo:local` uses the password `squishy-admin` unless `ADMIN_PASSWORD` is set. The password is printed on startup. This default exists only in the local demo script.
- On Vercel, add `ADMIN_PASSWORD` (and optionally `ADMIN_SESSION_SECRET`) as project environment variables, then redeploy.
- Without a valid password the page shows a "not configured" message and the admin API refuses logins.

## What it does

| Tab | Use it to |
|---|---|
| Dashboard | See orders by status, paid revenue, active products, and low-stock items (10 or fewer). Status cards open the filtered order list. |
| Orders | Filter by status, search by order number, name or email, open an order to see customer, items, totals and history. **Mark as shipped** (To Ship → Shipped), **Mark as delivered** (Shipped → Completed; COD becomes Paid), or **Cancel order** (To Pay / To Ship; stock is returned exactly once, a paid order is recorded as Refunded). |
| Products | Quick-edit **available stock** inline. Add or edit products: name, price, badge, image path, description, specs (one `Label: Value` per line), visibility. Bundles are built from existing single products; their stock is derived from the parts. |
| Vouchers | Create, edit, hide or delete vouchers (percentage, fixed peso amount, free shipping) with a minimum spend. |
| Reviews | Read verified reviews and delete inappropriate ones. |

## Behaviour worth knowing

- **Stock is "available now".** `products.stock` already has open orders subtracted. Editing it overwrites that number. Use it for restocks and corrections.
- **Products cannot be deleted** because past orders reference them. Untick "Visible in the store" instead. Hiding a single product also makes bundles that contain it unavailable.
- **Price changes** apply immediately. A customer mid-checkout is asked to review a fresh quote.
- **Images** are paths to files that already exist under `assets/images/`. There is no upload; add the file to the repository and redeploy.
- **Voucher edits and deletes** never change past orders (discounts are snapshotted).
- Order actions use the same locking and event log as the customer flow, so history on the order and the customer's tracking page stay consistent. Refunds are simulated records only; no money moves.

## Security notes

- One shared password, compared in constant time. Login is limited to 10 attempts per minute per IP (stored in the database, so it works across serverless instances).
- The session is a signed, `HttpOnly`, `SameSite=Strict` cookie scoped to `/api/admin`, valid for 8 hours, and `Secure` on HTTPS deployments. It is stateless: **Log out** clears the browser's cookie, but a copied cookie stays valid until it expires. To sign everyone out immediately, change `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` and redeploy.
- Admin writes use the same same-origin and JSON checks as the rest of the API (no wildcard CORS).
- All customer-supplied text is rendered as plain text, never HTML.
- This is suitable for a school demo or a small shop. For anything larger, add per-user accounts and an audit log.

## API

All routes are under `/api/admin`, return the usual `{ success, data }` envelope, and (except `login`, `logout`, `session`) need the admin cookie.

| Route | Purpose |
|---|---|
| `POST /login` `{ password }`, `POST /logout`, `GET /session` | Authentication |
| `GET /summary` | Dashboard figures |
| `GET /products`, `POST /products`, `PUT /products/:slug`, `PATCH /products/:slug/stock` | Catalog and stock (prices in pesos) |
| `GET/POST /vouchers`, `PUT/DELETE /vouchers/:code` | Vouchers (fixed amounts and minimum spend in pesos) |
| `GET /orders?status=&q=`, `GET /orders/:number`, `POST /orders/:number/action` `{ action: ship\|complete\|cancel, reason? }` | Orders |
| `GET /reviews`, `DELETE /reviews/:id` | Review moderation |

Tests: `npm test` includes `tests/admin.test.js`.
