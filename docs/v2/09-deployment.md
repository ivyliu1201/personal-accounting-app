# 部署 V2

## 1. 部署目標

- 前端：Cloudflare Pages。
- 後端 API：Cloudflare Worker。
- 資料庫：Supabase Postgres。
- 登入驗證：Firebase Authentication。

## 2. Worker 部署

必要 Worker secrets 與變數以 `06-env.md` 為準。部署前需確認至少包含：

```text
FIREBASE_PROJECT_ID
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APP_CORS_ALLOWED_ORIGINS
```

部署：

```powershell
cd worker
npm run deploy
```

部署後，記錄 Worker URL，並作為前端的 `VITE_API_BASE_URL`。

## 3. 前端部署

Build 前需依 `06-env.md` 設定前端環境變數，至少包含：

```text
VITE_API_BASE_URL=https://<worker-domain>
VITE_FIREBASE_API_KEY=<firebase-web-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
VITE_FIREBASE_PROJECT_ID=<firebase-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<firebase-storage-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<firebase-sender-id>
VITE_FIREBASE_APP_ID=<firebase-app-id>
```

Build：

```powershell
cd frontend
npm run build
```

將 `frontend/dist` 部署到 Cloudflare Pages。

## 4. Firebase 設定

正式前端網域必須加入 Firebase Authentication 允許網域。

部署後需在正式前端網域測試 Google 登入。

## 5. CORS

Worker 的 `APP_CORS_ALLOWED_ORIGINS` 必須包含 Cloudflare Pages 前端 origin。

範例：

```text
https://personal-accounting-frontend.pages.dev
```

## 6. 部署驗證

部署後：

- 開啟前端 URL。
- 確認未登入首頁可載入。
- 使用 Google 登入。
- 確認 `/api/auth/me` 成功。
- 確認今日明細可載入。
- 若使用測試帳號，建立一筆小額測試帳目。
- 確認首頁與歷史查看可更新。
