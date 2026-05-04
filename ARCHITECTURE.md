# ARCHITECTURE.md

## Current Runtime Path (2026-05-04)

- Frontend: Vue 3 (`frontend`)
- Backend: Cloudflare Worker (`worker`)
- Database: Supabase Postgres
- Auth: Firebase Authentication

## Notes

- Worker API routes stay under `/api/...` and are compatible with existing frontend calls.
- Worker no longer uses D1 binding for runtime queries.
- Supabase access is done through `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

## Required Worker Secrets

- `FIREBASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Deployment Direction

- Frontend deploy to Cloudflare Pages.
- Backend deploy with `wrangler deploy`.
- Frontend `VITE_API_BASE_URL` should point to Worker URL.
