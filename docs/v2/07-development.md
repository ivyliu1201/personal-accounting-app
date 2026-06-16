# 開發方式 V2

## 1. 建議本機路徑

V2 建議的本機開發路徑為：

```text
前端 dev server
  -> 本機 Worker dev server
  -> Supabase Postgres
```

## 2. 前置需求

- Node.js 與 npm。
- 透過 Worker 專案依賴使用 Cloudflare Wrangler。
- Firebase project 設定。
- Supabase project 設定。
- 依 `.env.example` 建立本機 `.env`。

## 3. 安裝依賴

前端：

```powershell
cd frontend
npm install
```

Worker：

```powershell
cd worker
npm install
```

## 4. 本機啟動 Worker

```powershell
cd worker
npm run dev:local
```

`dev:local` 會載入專案根目錄 `.env`，供 Worker 取得 Firebase project id 與 Supabase 設定。

預期本機 Worker URL：

```text
http://localhost:8787
```

## 5. 本機啟動前端

使用 Vite dev server，並將 API 請求 proxy 到本機 Worker：

```powershell
cd frontend
$env:VITE_API_PROXY_TARGET='http://localhost:8787'
npm run dev -- --host localhost
```

Dev 模式會忽略 `.env` 中的 `VITE_API_BASE_URL`，確保本機操作打到 `VITE_API_PROXY_TARGET` 指定的 Worker。

預期前端 URL：

```text
http://localhost:5173
```

Firebase 本機登入應使用 `localhost`。

## 6. 開發規則

- 產品變更必須維持在 `01-product-spec.md` 定義範圍內。
- 除非先更新產品規格，否則不得新增頁面或主要流程。
- 前端 API 呼叫維持在 `/api/...`。
- 服務密鑰不得進入前端程式碼。
- Worker 查詢必須依 Firebase uid 限制使用者資料。
- 行為、API、環境變數、資料庫、測試或部署方式改變時，需同步更新 V2 文件。
- 若實作後發現文件會誤導下一位開發者或 AI agent，該文件更新需視為本步交付的一部分，除非使用者明確要求本步只做盤點不修改。

## 7. 開發流程規則來源

實作節奏、事前回報、完成回報、文件版控與 Git 規則以 `AGENTS.md` 為準。

本文件只維護本機開發路徑、啟動方式與開發時需注意的環境前提。
