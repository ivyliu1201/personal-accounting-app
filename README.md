# Personal Accounting App

個人記帳 Web App。MVP 目前提供批次新增記帳、最近明細、類別摘要與歷史查看。

## Docker 啟動

啟動整套服務：

```bash
docker compose up -d
```

服務啟動後開啟：

```text
http://127.0.0.1:5173
```

Docker 服務：

| Service | Port | 用途 |
| --- | ---: | --- |
| frontend | 5173 | Vue 前端網站 |
| backend | 8080 | Spring Boot API |
| postgres | 15432 | PostgreSQL |

停止整套服務：

```bash
docker compose down
```

查看服務狀態：

```bash
docker compose ps
```

## 本機開發

本機開發時建議只用 Docker 啟動 PostgreSQL：

```bash
docker compose up -d postgres
```

啟動後端：

```bash
cd backend
.\mvnw.cmd spring-boot:run
```

啟動前端：

```bash
cd frontend
npm run dev
```

本機開發同樣使用：

```text
http://127.0.0.1:5173
```

如果 Docker 版前端或後端已經啟動，先停止它們再跑本機服務，避免 port 衝突：

```bash
docker compose stop frontend backend
```

## 測試與檢查

前端 build：

```bash
cd frontend
npm run build
```

後端測試：

```bash
cd backend
.\mvnw.cmd test
```

Docker compose 設定檢查：

```bash
docker compose config
```

## 環境變數

可參考 `.env.example` 調整本機 port 與資料庫連線設定。

常用預設值：

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
APP_ALLOWED_USER_EMAILS=fannyliu1201@gmail.com,ccindy0602@gmail.com
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

Firebase Authentication 預設關閉，後端會使用 `APP_DEV_USER_ID` 作為本機開發使用者。
啟用 Firebase 時，將 `APP_FIREBASE_ENABLED` 設為 `true`，並設定 `FIREBASE_SERVICE_ACCOUNT_PATH` 指向本機 service account JSON。
`APP_ALLOWED_USER_EMAILS` 使用逗號分隔，之後新增可登入的 Gmail 只需要追加到此變數。
前端 Firebase Web 設定使用 `VITE_FIREBASE_*` 變數，這些值會在前端 build 時注入。
前端 API 預設使用同網域 `/api`；本機 Vite dev proxy 可用 `VITE_API_PROXY_TARGET` 切換至 Spring Boot 或 Worker，例如 `http://localhost:8080` 或 `http://localhost:8787`。
若設定 `VITE_API_BASE_URL`，前端會直接把 `/api/...` 請求改送到該 base URL；跨網域使用 Worker 時需先完成 Worker CORS 設定。

## 本機 Worker API 驗證

先在 `worker` 套用本機 D1 migration 並啟動 Worker：

```bash
cd worker
npm run d1:migrate:local
npm run dev:local
```

另一個終端機可執行 smoke check：

```bash
cd worker
npm run smoke:local
```

若要讓前端本機 dev server 轉向 Worker：

```powershell
cd frontend
$env:VITE_API_PROXY_TARGET='http://localhost:8787'
npm run dev
```

目前 Worker 交易 API 需要 Firebase ID token；未登入時 protected API 回 `401` 是預期行為。
