# 部署 V2

## 1. 部署目標

- 前端：Cloudflare Pages，透過 GitHub integration 從 `master` push 自動部署。
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

前端正式部署主線使用 Cloudflare Pages GitHub integration。

GitHub repository：

```text
https://github.com/ivyliu1201/personal-accounting-app
```

Cloudflare Pages 設定：

| 項目 | 值 |
|---|---|
| Production branch | `master` |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |

Cloudflare Pages 環境變數需依 `06-env.md` 設定，至少包含：

```text
VITE_API_BASE_URL=https://<worker-domain>
VITE_FIREBASE_API_KEY=<firebase-web-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
VITE_FIREBASE_PROJECT_ID=<firebase-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<firebase-storage-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<firebase-sender-id>
VITE_FIREBASE_APP_ID=<firebase-app-id>
```

設定完成後，push 到 GitHub `master` branch 會由 Cloudflare Pages 自動執行 build 與部署。

本機部署前驗證仍可執行：

```powershell
cd frontend
npm run build
```

除非 Cloudflare Pages GitHub integration 暫時不可用，否則不使用 Wrangler direct upload 作為正式前端部署主線。

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
