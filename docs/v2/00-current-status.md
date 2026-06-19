# 目前狀態 V2

## 1. 文件目的

本文件是目前個人記帳系統狀態的入口文件。

V2 文件描述的是現在應該如何理解這個系統，不保留過時的遷移紀錄或已不作為主線的架構說法。

## 2. 目前系統

- 產品：個人記帳 Web App。
- 前端：`frontend` 目錄中的 Vue 3。
- 後端 API：`worker` 目錄中的 Cloudflare Worker。
- 資料庫：Supabase Postgres。
- AI 快速新增服務：獨立的 AI Category Service，正式目標為 Cloud Run；模型訓練由本機手動執行後再重新部署。
- 登入驗證：Firebase Authentication，使用 Google 登入。
- 前端正式部署目標：Cloudflare Pages，透過 GitHub integration 自動部署 `master`。
- 後端正式部署目標：Cloudflare Workers。

## 3. 目前功能概覽

目前系統已支援個人記帳 MVP 主流程：

- Google 登入。
- 依 Firebase 使用者 ID 隔離個人資料。
- 批次新增收入與支出帳目。
- 首頁近期資料與本月摘要。
- 歷史查看、圖表分析、編輯與刪除。
- 預設類別與使用者自訂類別。
- AI 快速新增的 Worker API、日期解析、類別映射與 feedback 儲存。

完整產品範圍以 `01-product-spec.md` 為準。

## 4. 目前主要目錄

```text
frontend/   Vue 3 前端應用
worker/     Cloudflare Worker API，連接 Supabase Postgres
docs/v2/    目前版本文件
```

## 5. 目前執行路徑

V2 的執行路徑為：

```text
瀏覽器
  -> Vue 3 前端
  -> /api/... 請求
  -> Cloudflare Worker
  -> Supabase Postgres
  -> AI Category Service
```

Firebase Authentication 在前端執行。前端會把 Firebase ID token 放在 `Authorization: Bearer <token>` header 中傳給 Worker。Worker 驗證 token 後，使用 Firebase 使用者 ID 作為系統中的 `user_id`。

## 6. 文件入口

完整文件用途與 AI 必讀順序定義於 `docs/v2/AGENTS.md`。

一般閱讀建議：

1. `docs/v2/00-current-status.md`
2. `docs/v2/01-product-spec.md`
3. `docs/v2/03-architecture.md`
4. `docs/v2/AGENTS.md`

## 7. 文件規則

- 產品行為以 `01-product-spec.md` 為準。
- 版面輔助以 `02-wireframe.md` 為準。
- 執行架構以 `03-architecture.md` 為準。
- AI 協作規則以 `AGENTS.md` 為準。

若文件內容衝突，優先順序為：

```text
01-product-spec.md
> 02-wireframe.md
> 03-architecture.md
> 04-api.md
> 05-database.md
> 06-env.md
> 07-development.md
> 08-testing.md
> 09-deployment.md
> AGENTS.md
```

## 8. 文件版控規則

若實際開發結果、部署方式、API、資料庫 schema、環境變數、測試方式或產品行為與 V2 文件不一致，且該差異可能誤導人或 AI agent，必須同步更新對應 V2 文件。

詳細判斷與對應文件依 `AGENTS.md` 的「文件版控規則」執行。不得只修改程式碼而留下會誤導後續開發的文件。

## 9. 目前範圍邊界

目前範圍與非本階段範圍以 `01-product-spec.md` 為準。除非先更新產品規格，否則不得新增產品規格未定義的頁面、功能或主要流程。
