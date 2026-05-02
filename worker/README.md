# Cloudflare Worker POC

This directory contains the Cloudflare Workers proof of concept for the personal accounting app.

## Current Scope

- `GET /api/health`
- `GET /api/auth/me` Firebase authentication POC endpoint
- `GET /api/transactions/categories?type=EXPENSE|INCOME`
- `POST /api/transactions/batch`
- `GET /api/transactions/recent?limit=5|10|15`
- `GET /api/transactions/history?type=EXPENSE|INCOME&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&page=0&size=10`
- `GET /api/transactions/category-summary?type=EXPENSE|INCOME&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/transactions/history-trend?type=EXPENSE|INCOME&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/transactions/cash-flow-trend?year=YYYY`
- `PUT /api/transactions/{id}`
- `DELETE /api/transactions/{id}`
- Local Worker TypeScript setup
- D1 migration draft matching the current PostgreSQL MVP schema

## Not Yet Implemented

- Cloudflare D1 cloud database creation
- Data migration from PostgreSQL to D1
- Deployment

## Firebase Auth Notes

- The Worker validates Firebase ID tokens from `Authorization: Bearer <token>`.
- `FIREBASE_PROJECT_ID` must be configured before using protected endpoints.
- `FIREBASE_PROJECT_ID` is not a secret, but real secrets must still use Cloudflare secrets.
- The auth module verifies Firebase JWT issuer and audience against `FIREBASE_PROJECT_ID`.
- The auth module requires both Firebase `sub` and `email` claims before returning an authenticated user.

## Local Worker + D1 Verification

Run these commands from the `worker` directory.

Apply the D1 migration to Wrangler's local D1 store:

```bash
npm run d1:migrate:local
```

Start the Worker locally on port 8787:

```bash
npm run dev:local
```

In another terminal, run the local smoke check:

```bash
npm run smoke:local
```

The smoke check verifies:

- `GET /api/health` returns `200`.
- Protected endpoints without a Firebase token return `401`.

Manual frontend-to-Worker verification can be started with the Worker running:

```bash
cd ../frontend
$env:VITE_API_PROXY_TARGET='http://localhost:8787'
npm run dev
```

Then open `http://127.0.0.1:5173`. Successful transaction API calls still require a valid Firebase login token. Without login, protected Worker endpoints returning `401` is expected.

## D1 Notes

- `ACCOUNTING_DB` is the Worker binding name.
- `database_id` is intentionally set to `TODO_CREATE_D1_DATABASE_BEFORE_DEPLOY`.
- Do not deploy this Worker until a D1 database is created and the real `database_id` is configured.
- D1 uses SQLite semantics. The `amount` column is currently defined as `numeric` to stay close to the existing PostgreSQL schema, but storing amounts as integer cents remains a TODO before production migration.

## Security Notes

- D1 must only be accessed through Worker API code.
- Production APIs must validate Firebase ID tokens before reading or writing user data.
- Every query that touches user data must filter by authenticated user ID.
- CORS must be restricted to known frontend origins before deployment.
- Secrets must be configured through Cloudflare secrets and must not be committed.
