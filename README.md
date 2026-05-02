# Personal Accounting App

個人記帳 Web App。MVP 目前提供 Google 登入、批次新增記帳、最近明細、類別摘要、歷史查看、年度現金流趨勢、編輯與刪除。

## 目前建議測試方式

目前建議用本機 Worker + 本機前端測試最新功能。

先啟動 Worker：

```powershell
cd worker
npm run d1:migrate:local
npm run dev:local
```

再開另一個終端機啟動前端：

```powershell
cd frontend
$env:VITE_API_PROXY_TARGET='http://localhost:8787'
npm run dev -- --host localhost
```

開啟：

```text
http://localhost:5173
```

注意：

- Firebase 登入本機測試請使用 `localhost`，不要使用 `127.0.0.1`。
- Worker 交易 API 需要 Firebase ID token；未登入時 protected API 回 `401` 是預期行為。
- 本機 Worker 使用 Wrangler local D1，不會部署到 Cloudflare，也不會產生雲端費用。

## 本機 Smoke Check

Worker 啟動後，可以在另一個終端機執行：

```powershell
cd worker
npm run smoke:local
```

目前 smoke check 會確認：

- `GET /api/health` 回 `200`
- 未登入呼叫 protected API 回 `401`

## Spring Boot 回退模式

Spring Boot + PostgreSQL 目前保留作為回退路徑。

本機開發時可只用 Docker 啟動 PostgreSQL：

```powershell
docker compose up -d postgres
```

啟動後端：

```powershell
cd backend
.\mvnw.cmd spring-boot:run
```

啟動前端並指向 Spring Boot：

```powershell
cd frontend
$env:VITE_API_PROXY_TARGET='http://localhost:8080'
npm run dev -- --host localhost
```

開啟：

```text
http://localhost:5173
```

## Docker 啟動

Docker Compose 目前仍是 Spring Boot + PostgreSQL 路徑。

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
cd worker
npm run typecheck
npm test
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
- `VITE_API_PROXY_TARGET=http://localhost:8787` 可讓 Vite dev server 指向本機 Worker。
- `VITE_API_PROXY_TARGET=http://localhost:8080` 可讓 Vite dev server 指向 Spring Boot。
- 若設定 `VITE_API_BASE_URL`，前端會直接把 `/api/...` 請求送到該 base URL；跨網域使用 Worker 時需先完成 Worker CORS 設定。

## 付費與雲端操作限制

- 目前本機 Worker + local D1 不需要付費。
- 不要直接執行 Cloudflare deploy 或建立遠端 D1，除非已確認 Cloudflare 帳號、額度與付款需求。
- 任何需要 Cloudflare Workers Paid、D1 付費額度、綁定信用卡或其他付費功能的操作，都必須先取得使用者確認。
