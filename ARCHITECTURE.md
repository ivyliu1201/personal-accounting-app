# ARCHITECTURE.md

## Current Runtime Path (2026-06-18)

- Frontend: Vue 3 (`frontend`)
- Backend: Cloudflare Worker (`worker`)
- Database: Supabase Postgres
- Auth: Firebase Authentication
- AI quick add: Worker calls the external AI Category Service; the frontend does not call it directly.

## Notes

- Worker API routes stay under `/api/...` and are compatible with existing frontend calls.
- Worker no longer uses D1 binding for runtime queries.
- Supabase access is done through `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
- AI quick add parse results are suggestions. Final user-edited rows are written as normal transactions first; AI feedback is written only after the transaction insert succeeds.
- Failed transaction inserts must not create AI feedback or training candidates.

## Required Worker Secrets

- `FIREBASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_CATEGORY_SERVICE_URL`
- `AI_CATEGORY_SERVICE_TOKEN`

## Deployment Direction

- Frontend deploy to Cloudflare Pages.
- Backend deploy with `wrangler deploy`.
- Frontend `VITE_API_BASE_URL` should point to Worker URL.
- Supabase must include the `ai_quick_add_feedback` table and grant `service_role` access before deployed quick-add feedback can work.
