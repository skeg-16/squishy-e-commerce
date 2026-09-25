# Vercel and PostgreSQL deployment

## Configure a preview

1. Create a Neon PostgreSQL database for preview/demo data. Keep preview data separate from any other environment.
2. Connect the repository to Vercel with the repository root as the project root. Use the checked-in `vercel.json`; do not select the nested legacy site directory.
3. Set these server-side environment variables for the preview:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Provider's pooled PostgreSQL URL, including its TLS settings |
| `DEMO_MODE` | `true` for this school simulation |
| `APP_ORIGIN` | Exact HTTPS storefront origin without trailing slash |

The API additionally allows Vercel-provided deployment/branch origins from `VERCEL_URL` and `VERCEL_BRANCH_URL`, so generated previews work without hardcoding their URL in browser code. Custom domains must be configured through APP_ORIGIN. Secure cookies are enabled on Vercel.

4. Set the same preview database connection locally in ignored `.env`, then run `npm run db:migrate` and `npm run db:seed`. Migrations and seeds are explicit commands, not functions that race on every cold start.
5. Deploy a preview. The build copies only the five canonical HTML pages, required JavaScript, stylesheet, and assets to `public/`. The `api/index.js` function routes `/api/*` to Express. Production installation omits embedded PostgreSQL, browser tooling, and test dependencies.

## Preview acceptance gate

Before promoting the preview, verify:

- `/api/health` returns success, and `/api/products` returns 10 products/offers.
- `/server/squishies-db.json`, `/.env`, `/package.json`, `/server/catalog.json`, and nested legacy site paths return 404.
- A new browser can obtain a session and place a COD order. Refresh preserves the receipt.
- A separate browser cannot access that order, even with its exact reference.
- Electronic payment decline → retry → success works and is visibly labeled as simulation.
- FREESHIP totals exactly the merchandise subtotal. Paid demo cancellation records Refunded and restores stock once.
- No requests target localhost, no credentials reach the client bundle, and cookies carry Secure/HttpOnly/SameSite.
- Restart/redeploy the function and confirm the saved order is still retrievable from the same browser session.
- Run the mobile layout and keyboard checks from the demo guide.

Only after these checks pass, configure the intended public demo domain and promote that verified deployment. Creating a preview requires the project owner's Vercel access and database configuration; these are not supplied by the repository.

## Rollback and operations

Keep migrations additive after the initial schema. Preview each release against a separate database before applying migrations to the shared school demo. For an application regression, return Vercel to the last verified deployment compatible with the installed schema. Do not restore the old JSON-backed checkout as a fallback.

Use request IDs from 5xx responses to correlate structured function logs. Check `/api/health` for database connectivity. A failed database write returns an error, never a fake receipt. Retry uncertain writes with the same idempotency key.

Seed is non-destructive. For a fresh presentation dataset, use a new dedicated database or the isolated test fixtures; do not truncate the shared demo database. Database backups and access management are handled in the database provider's console. Expiration is reconciled on requests; no cron is required.

References: [Vercel Express](https://vercel.com/docs/frameworks/backend/express), [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js), [node-postgres transactions](https://node-postgres.com/features/transactions).
