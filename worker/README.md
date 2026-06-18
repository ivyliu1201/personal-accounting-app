# Cloudflare Worker Backend (Supabase)

Worker API 保留原本路由，資料庫改為 Supabase Postgres。

## Required Secrets

設定在 Cloudflare Worker。Local 預設由 `npm run dev:local` 載入專案根目錄 `.env`：

- `FIREBASE_PROJECT_ID` 或 `VITE_FIREBASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_CATEGORY_SERVICE_URL`
- `AI_CATEGORY_SERVICE_TOKEN`

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

## AI Quick Add Feedback

快速新增解析流程由 Worker 呼叫 AI Category Service。前端送出批次新增時，若資料來自快速新增，Worker 會在帳目成功新增後寫入 `ai_quick_add_feedback`：

- `accepted`：AI 建議與使用者最後送出的資料一致。
- `corrected`：使用者在送出前修改了 AI 建議。
- `missed_by_ai`：同一快速新增 session 中，使用者手動補上 AI 漏掉的列。

若帳目新增失敗，不會寫入 feedback。若 feedback 寫入失敗，已成功建立的帳目不會被回滾，避免記帳主流程被訓練資料流程阻塞。

## Supabase Migration Note

`worker/migrations` 內的 SQL 是正式 Supabase schema 變更來源之一。`ai_quick_add_feedback` 需要 `service_role` 權限；若遠端已建立 table 但 Worker 讀寫失敗，請在 Supabase SQL Editor 套用：

```sql
grant usage on schema public to service_role;

grant select, insert, update, delete
    on table ai_quick_add_feedback
    to service_role;
```
