# Cloudflare Worker Backend (Supabase)

Worker API 保留原本路由，資料庫改為 Supabase Postgres。

## Required Secrets

設定在 Cloudflare Worker。Local 預設由 `npm run dev:local` 載入專案根目錄 `.env`：

- `FIREBASE_PROJECT_ID` 或 `VITE_FIREBASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Local Run

```powershell
cd worker
npm install
npm run dev:local
```

`dev:local` 會執行 `wrangler dev --local --port 8787 --env-file ../.env`，避免把 Supabase service role key 複製到 `worker/.dev.vars`。

## Deploy

```powershell
cd worker
wrangler secret put FIREBASE_PROJECT_ID
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run deploy
```

部署後把前端 `VITE_API_BASE_URL` 指到 Worker URL。
