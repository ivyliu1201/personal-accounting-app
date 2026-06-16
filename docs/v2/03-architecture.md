# 系統架構 V2

## 1. 執行架構

```text
使用者瀏覽器
  -> Cloudflare Pages 前端
  -> Cloudflare Worker API
  -> Supabase Postgres
```

登入驗證：

```text
使用者瀏覽器
  -> Firebase Authentication Google 登入
  -> Firebase ID token
  -> Worker 驗證 token
  -> Worker 使用 Firebase uid 作為 user_id
```

## 2. 系統元件

### 2.1 前端

- 位置：`frontend`。
- 框架：Vue 3。
- 建置工具：Vite。
- 登入用戶端：Firebase Web SDK。
- 主要 API 呼叫慣例：`/api/...`。
- 正式環境 API base URL 由 `VITE_API_BASE_URL` 設定；本機 dev 模式固定走 Vite `/api` proxy。

職責：

- 呈現首頁與歷史查看頁。
- 處理 Firebase Google 登入與登出。
- 在受保護 API 請求中附上 Firebase ID token。
- 在送出前執行基本表單完整性檢查。
- 顯示 loading、成功、失敗與空狀態。
- 呈現甜甜圈圖、摘要表、今日明細、歷史明細與年度現金流趨勢。

### 2.2 Worker API

- 位置：`worker`。
- 執行環境：Cloudflare Workers。
- 主要入口：`worker/src/index.ts`。
- 登入驗證：`worker/src/auth.ts`。
- Supabase client：`worker/src/db.ts`。
- 帳目邏輯：`worker/src/transactions.ts`。
- 類別邏輯：`worker/src/categories.ts`。

職責：

- 驗證 Firebase ID token。
- 強制套用使用者資料範圍。
- 提供帳目與類別 API。
- 驗證帳目 payload。
- 需要時建立自訂類別。
- 查詢 Supabase Postgres。
- 回傳穩定的 JSON response。

### 2.3 資料庫

- 平台：Supabase Postgres。
- 主要資料表與資料隔離規則定義於 `05-database.md`。

## 3. API 邊界

所有產品 API route 使用 `/api/...`。

前端不得直接存取 Supabase。

前端不得保存 service role key 或資料庫憑證。

## 4. 資料歸屬

- Worker 必須一律以 Firebase uid 限制使用者資料範圍。
- 詳細資料歸屬、預設類別與自訂類別規則以 `05-database.md` 為準。

## 5. 安全規則

- 受保護 API route 需要 `Authorization: Bearer <Firebase ID token>`。
- 缺少或無效 token 時回傳登入驗證錯誤。
- 服務憑證只能存在 Worker secrets 或本機開發用 secret 檔。
- 前端環境變數可包含 Firebase Web config，但不可包含後端服務密鑰。

## 6. 錯誤處理

- 驗證錯誤應回傳 `400`。
- 登入驗證錯誤應回傳 `401`。
- 找不到帳目應回傳 `404`。
- 未預期的伺服器錯誤應回傳 `500`，且訊息需對使用者安全。
- 錯誤 response 使用 JSON，包含 `message` 欄位。

## 7. 目前架構規則

V2 文件將 Cloudflare Worker + Supabase Postgres 視為目前後端架構。

除非先更新本文件，否則不得在 V2 文件中把其他後端路徑描述為目前主線。

## 8. 架構文件版控規則

若實際開發結果或部署方式讓目前架構不再符合本文件，必須更新本文件。

需要更新本文件的情況包含：

- 前端部署目標改變。
- 後端 API runtime 改變。
- 資料庫服務或主要資料存取方式改變。
- 登入驗證方式改變。
- API 邊界不再是 `/api/...`。
- 使用者資料隔離方式改變。
- 新增會影響整體架構的外部服務。

若架構改變也影響本機開發、部署、環境變數、API 或資料庫，必須同步更新：

- `07-development.md`
- `09-deployment.md`
- `06-env.md`
- `04-api.md`
- `05-database.md`
- `00-current-status.md`
- `AGENTS.md`
