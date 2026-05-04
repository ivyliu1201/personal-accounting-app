# Personal Accounting App

個人記帳 Web App。MVP 目前提供 Google 登入、批次新增記帳、最近明細、類別摘要、歷史查看、年度現金流趨勢、編輯與刪除。

## 目前建議測試方式

目前建議用本機 Spring Boot（連 Supabase Postgres）+ 本機前端測試。

最快方式：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-backend-app.ps1
```

再開另一個終端機啟動前端：

```powershell
cd frontend
$env:VITE_API_PROXY_TARGET='http://localhost:8080'
npm run dev -- --host localhost
```

開啟：

```text
http://localhost:5173
```

注意：

- Firebase 登入本機測試請使用 `localhost`，不要使用 `127.0.0.1`。
- `frontend` 的 Vite 設定會從 repo root 的 `.env` 讀取 Firebase Web 設定，所以前端相關環境變數請維持在專案根目錄。
- 後端保護 API 需要 Firebase ID token；未登入時回 `401` 是預期行為。

## Docker 啟動

Docker Compose 目前仍是 Spring Boot 路徑；資料庫可用容器 PostgreSQL 或 Supabase Postgres。

啟動整套服務：

```powershell
docker compose up -d
```

服務啟動後開啟：

```text
http://localhost:5173
```

Docker 服務：

| Service | Port | 用途 |
| --- | ---: | --- |
| frontend | 5173 | Vue 前端網站 |
| backend | 8080 | Spring Boot API |
| postgres | 15432 | PostgreSQL |

停止整套服務：

```powershell
docker compose down
```

查看服務狀態：

```powershell
docker compose ps
```

如果 Docker 版前端或後端已經啟動，先停止它們再跑本機服務，避免 port 衝突：

```powershell
docker compose stop frontend backend
```

## 測試與檢查

前端 build：

```powershell
cd frontend
npm run build
```

前端日期格式測試：

```powershell
cd frontend
npm run test:date-format
```

Worker 測試：

```powershell
不使用（已停用，見 worker/README.md）
```

後端測試：

```powershell
cd backend
.\mvnw.cmd test
```

Docker compose 設定檢查：

```powershell
docker compose config
```

## 環境變數

可參考 `.env.example` 建立或調整本機 `.env`。

常用變數：

```text
FRONTEND_PORT=5173
BACKEND_PORT=8080
POSTGRES_PORT=15432
POSTGRES_DB=personal_accounting
POSTGRES_USER=personal_accounting
POSTGRES_PASSWORD=change_me
APP_DEV_USER_ID=dev-user
APP_AUTH_DEV_FALLBACK_ENABLED=true
APP_FIREBASE_ENABLED=false
APP_ALLOWED_USER_EMAILS=your-email@example.com
FIREBASE_SERVICE_ACCOUNT_PATH=C:\path\to\personal-accounting-firebase-admin.json
VITE_FIREBASE_API_KEY=your-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-web-app-id
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=http://localhost:8080
```

說明：

- 前端 Firebase Web 設定使用 `VITE_FIREBASE_*`，會在前端 build 時注入。
- `frontend/vite.config.ts` 會從 repo root `.env` 讀取前端環境變數，所以本機開發時請把 `VITE_FIREBASE_*` 和 `VITE_API_PROXY_TARGET` 放在專案根目錄 `.env`。
- `VITE_API_PROXY_TARGET=http://localhost:8080` 可讓 Vite dev server 指向 Spring Boot。
- 若設定 `VITE_API_BASE_URL`，前端會直接把 `/api/...` 請求送到該 base URL；跨網域時需先完成後端 CORS 設定。
- `APP_CORS_ALLOWED_ORIGINS` 用逗號分隔可允許的前端網域（例如 `http://localhost:5173,https://your-pages.pages.dev`）。

Supabase 連線請設定：

```text
SPRING_DATASOURCE_URL=jdbc:postgresql://<supabase-host>:5432/postgres?sslmode=require
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=<your-supabase-db-password>
```

## Cloudflare 佈署前提醒

- 目前資料庫路徑為 Supabase Postgres，非 D1。
- 部署到 Cloudflare 前，請先確認後端實際部署位置與 CORS allowed origins。

## Cloudflare Worker 後端（Supabase）

Worker 需要這三個 secret：

- `FIREBASE_PROJECT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

部署指令：

```powershell
cd worker
wrangler secret put FIREBASE_PROJECT_ID
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npm run deploy
```

## Cloudflare 線上部署（前端）

1. 設定後端正式 URL（可連 Supabase）。
2. 在後端環境設定：
   - `APP_CORS_ALLOWED_ORIGINS=https://<your-pages-domain>`
3. 前端 build 前設定：
   - `VITE_API_BASE_URL=https://<your-backend-domain>`
4. 建置前端：

```powershell
cd frontend
npm run build
```

5. 部署 `frontend/dist` 到 Cloudflare Pages（或你既有的 Cloudflare 靜態站流程）。

