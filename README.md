# Squishies — school demonstration store

A Node.js / Express storefront backed by PostgreSQL. The existing pastel design is retained. Checkout, inventory, fixed bundles, vouchers, guest-owned orders, payment simulations, tracking, and verified reviews run through the API.

**This is a school demonstration. Electronic payments and courier events are simulations. Use fictional customer details.**

## Quick start — no cloud account required

Requires Node.js 22 and npm. Run commands from the repository root:

```sh
npm ci
npm run demo:local
```

Open http://localhost:3000. The command starts real PostgreSQL on loopback port 55432, applies migrations, seeds the catalog, builds the unchanged page structure, and starts Express. Data persists in the ignored `.local/` directory between restarts. Ctrl+C stops both processes. Seeding never resets sold stock or deletes orders.

The embedded PostgreSQL binary is a development dependency, not a production database or a Vercel dependency. If your machine cannot run it, use a PostgreSQL connection with the setup below.

## PostgreSQL / Neon setup

1. Create a PostgreSQL database (Neon is the recommended hosted option).
2. Copy `.env.example` to `.env`. Set `DATABASE_URL` to the pooled connection string, keeping the provider's TLS settings. Never put this value in frontend JavaScript or commit it.
3. Set `APP_ORIGIN=http://localhost:3000` and `DEMO_MODE=true`.
4. Run:

```sh
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

The current JSON file is preserved as legacy local data; the new application never reads it or imports its orders. The canonical source pages are at the repository root. The nested `squishies-site/` copy and unused legacy root scripts are excluded from deployments.

## Verify

```sh
npm test
npx playwright install chromium
npm run test:browser
npm run build
```

`npm test` creates a real disposable PostgreSQL cluster and checks concurrency, retries, transactions, ownership, money calculations, order transitions, and validation. If using `TEST_DATABASE_URL`, its database name must include `test`; tests create and drop only their own random schema. Never point test configuration at a customer database.

Browser checks use their own PostgreSQL cluster and exercise desktop/mobile shopping, simulated payment failure and retry, lost checkout responses, receipt reloads, reviews, and public-file isolation. Screenshots are written to ignored `test-results/`.

## Deploy to Vercel

Follow [the deployment guide](docs/deployment.md). The project uses the existing `api/index.js` Express function and builds an explicit storefront allowlist to `public/`. Vercel installs production dependencies only. No runtime filesystem writes are used for commerce data.

The deploy needs a Vercel project, a cloud PostgreSQL database, and environment variables configured by a project owner. Local test success is not a claim that a cloud preview has been deployed.

## Team handoff

- [API contracts and examples](docs/api.md)
- [Database relationships and lifecycle rules](docs/architecture.md)
- [Presentation walkthrough and repeatable fixtures](docs/demo.md)
- [Deployment, verification, and rollback](docs/deployment.md)

No customer registration or admin interface is included. Guest orders belong to a random browser session in a 30-day HttpOnly cookie. Clearing that cookie or changing browsers removes access; order numbers alone do not grant access.
