# 環境變數 V2

## 1. 前端變數

這些變數供 Vue 前端在 build 或 dev server 執行時使用。

```text
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=
VITE_API_PROXY_TARGET=
```

規則：

- `VITE_FIREBASE_*` 為 Firebase Web config。
- `VITE_API_BASE_URL` 讓前端 API 請求指向已部署的 Worker URL。
- `VITE_API_PROXY_TARGET` 用於本機開發時的 Vite proxy。
- 不得把 Supabase service role key 放進前端變數。

## 2. Worker 變數與 secrets

必要 Worker 設定：

```text
FIREBASE_PROJECT_ID=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_CORS_ALLOWED_ORIGINS=
```

規則：

- `FIREBASE_PROJECT_ID` 用於驗證 Firebase ID token 的 issuer 與 audience。
- `SUPABASE_URL` 是 Supabase project URL。
- `SUPABASE_SERVICE_ROLE_KEY` 必須視為密鑰。
- `APP_CORS_ALLOWED_ORIGINS` 是前端 origin allowlist，以逗號分隔。

## 3. 本機開發

本機開發可從 `.env` 或 Worker 本機 secret 檔讀取設定。

不得提交真實密鑰。

`.env.example` 只能放 placeholder。

## 4. 正式環境

正式前端：

- 設定 Firebase Web config。
- build 前將 `VITE_API_BASE_URL` 設為已部署的 Worker URL。

正式 Worker：

- 敏感值應存放為 Worker secrets。
- 設定允許的前端 origins。

## 5. 環境變數變更規則

新增或重新命名環境變數時：

- 更新本文件。
- 更新 `.env.example`。
- 若影響正式環境，更新部署文件。
- 說明該變數為必填或選填。
