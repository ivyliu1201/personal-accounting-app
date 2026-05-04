# Cloudflare Worker Backend

This directory contains the Cloudflare Worker backend for the personal accounting app.

The Worker currently supports the MVP transaction APIs in local development with Wrangler local D1. Remote Cloudflare D1 creation and deployment are not completed yet.

## API Scope

- `GET /api/health`
- `GET /api/auth/me`
- `GET /api/transactions/categories?type=EXPENSE|INCOME`
- `POST /api/transactions/batch`
- `GET /api/transactions/recent?limit=5|10|15`
- `GET /api/transactions/history?type=EXPENSE|INCOME&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&page=0&size=10`
- `GET /api/transactions/category-summary?type=EXPENSE|INCOME&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/transactions/history-trend?type=EXPENSE|INCOME&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/transactions/cash-flow-trend?year=YYYY`
- `PUT /api/transactions/{id}`
- `DELETE /api/transactions/{id}`

Protected endpoints require `Authorization: Bearer <Firebase ID token>`.

## Local Worker + D1 Verification

Run these commands from the `worker` directory.

Apply the D1 migration to Wrangler's local D1 store:

```powershell
npm run d1:migrate:local
```

Start the Worker locally on port 8787:

```powershell
npm run dev:local
```

In another terminal, run the local smoke check:

```powershell
npm run smoke:local
```

The smoke check verifies:

- `GET /api/health` returns `200`.
- Protected endpoints without a Firebase token return `401`.

Manual frontend-to-Worker verification can be started with the Worker running:

```powershell
cd ../frontend
$env:VITE_API_PROXY_TARGET='http://localhost:8787'
npm run dev -- --host localhost
```

Then open:

```text
http://localhost:5173
```

Use `localhost` for Firebase local login. Do not switch this dev server to `127.0.0.1`, and keep the frontend Firebase Web env values in the repo root `.env` so Vite can read them.

Successful transaction API calls require a valid Firebase login token. Without login, protected Worker endpoints returning `401` is expected.

## Firebase Auth Notes

- The Worker validates Firebase ID tokens from `Authorization: Bearer <token>`.
- `FIREBASE_PROJECT_ID` must be configured before using protected endpoints.
- For local development, `worker/.dev.vars` can contain `FIREBASE_PROJECT_ID=your-project-id`.
- `worker/.dev.vars` is ignored by Git because it may contain local-only values.
- `FIREBASE_PROJECT_ID` is not a secret, but real secrets must still use Cloudflare secrets.
- The auth module verifies Firebase JWT issuer and audience against `FIREBASE_PROJECT_ID`.
- The auth module requires both Firebase `sub` and `email` claims before returning an authenticated user.

## D1 Notes

- `ACCOUNTING_DB` is the Worker binding name.
- `database_id` is intentionally set to `TODO_CREATE_D1_DATABASE_BEFORE_DEPLOY`.
- Do not deploy this Worker until a D1 database is created and the real `database_id` is configured.
- D1 uses SQLite semantics. The `amount` column is currently defined as `numeric` to stay close to the existing PostgreSQL schema.
- Storing amounts as integer cents remains a production hardening item before a final migration.

## Not Yet Completed

- Cloudflare remote D1 database creation.
- Real `database_id` configuration.
- Worker deployment to Cloudflare.
- Production CORS allowed origins.
- Data migration from PostgreSQL to D1.
- Remote environment data consistency verification.

## Security Notes

- D1 must only be accessed through Worker API code.
- Production APIs must validate Firebase ID tokens before reading or writing user data.
- Every query that touches user data must filter by authenticated user ID.
- CORS must be restricted to known frontend origins before deployment.
- Secrets must be configured through Cloudflare secrets and must not be committed.

## Paid Operation Rule

Local Wrangler and local D1 verification do not require paid Cloudflare features.

Do not create remote D1 databases, deploy Workers, enable Workers Paid, bind credit cards, or enable any paid Cloudflare feature without explicit user confirmation.

