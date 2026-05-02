# ARCHITECTURE.md

## 1. 目的

本文件記錄目前專案的架構狀態與 Cloudflare Workers / D1 遷移決策，避免把本機驗證、未部署功能或雲端資源狀態混在一起。

本文件不取代 `SPEC.md`。產品功能與登入行為仍以 `SPEC.md` 為準。

## 2. 目前狀態

### 2.1 產品功能

MVP 功能已在本機可測：

- Google 登入。
- 個人帳目資料隔離。
- 批次新增收入 / 支出帳目。
- 首頁最近明細。
- 首頁與歷史查看的類別摘要。
- 歷史查看明細查詢。
- 年度現金流趨勢。
- 單筆帳目編輯與刪除。
- 預設類別與自訂類別。

### 2.2 可執行架構

目前保留兩條路徑：

- 回退路徑：Vue 3 + Spring Boot + PostgreSQL。
- 遷移路徑：Vue 3 + Cloudflare Worker + local D1。

本機最新驗證重點放在 Worker + local D1。Spring Boot + PostgreSQL 暫時保留作為回退與對照，不在未確認前移除。

### 2.3 登入驗證

- 登入方式維持 Firebase Authentication。
- Worker API 以 Firebase ID token 驗證使用者。
- 若後續改用 Cloudflare Access 或其他驗證方式，必須先更新 `SPEC.md` 與本文件。

## 3. Cloudflare 遷移進度

已完成：

1. 建立 Cloudflare Workers / D1 最小 POC。
2. 實作 Firebase ID token 驗證。
3. 建立 D1 schema，對齊現有 PostgreSQL MVP 資料模型。
4. 遷移健康檢查與類別查詢 API。
5. 遷移批次新增帳目 API。
6. 遷移最近明細與歷史查詢 API。
7. 遷移類別摘要、歷史趨勢與年度現金流 API。
8. 遷移編輯與刪除 API。
9. 補上前端本機 dev target 切換，可指向 Spring Boot 或 Worker。
10. 補上本機 Worker + local D1 smoke check。

尚未完成：

- 建立 Cloudflare 遠端 D1 database。
- 設定正式 `database_id`。
- 部署 Worker 到 Cloudflare。
- 設定正式前端部署位置。
- 設定正式 CORS allowed origins。
- 從 PostgreSQL 匯出或遷移既有資料到 D1。
- 遠端環境資料一致性驗證。
- 評估何時停用 Spring Boot / PostgreSQL。

## 4. 目標架構

若後續確認採用 Cloudflare，目標為：

- 前端：Vue 3，部署到 Cloudflare Pages 或 Workers Static Assets。
- 後端：Cloudflare Workers。
- 資料庫：Cloudflare D1。
- 登入驗證：暫定維持 Firebase Authentication。

## 5. 遷移原則

- 不一次重寫整個系統。
- 每次只遷移一個小範圍，並保留可驗證的回退點。
- 未完成遠端 D1 與部署驗證前，不移除 Spring Boot、PostgreSQL 或既有 migration。
- Firebase 登入暫時保留；若要改 Cloudflare Access，必須另行確認。
- 所有會產生費用、需要綁定信用卡或升級付費方案的操作，必須先取得使用者確認。

## 6. 資安要求

- D1 不得直接公開給前端存取，所有資料操作必須經由 Worker API。
- Worker API 必須驗證 Firebase ID token，不得只依賴前端登入狀態。
- 所有帳目、類別與統計查詢都必須以登入使用者 ID 隔離資料。
- 修改與刪除 API 必須同時檢查資料擁有者。
- Cloudflare 與 Firebase secrets 不得提交到 Git。
- secrets 必須使用 Cloudflare Secrets 或等效安全機制管理。
- 正式 CORS 必須限制允許來源，不得在正式環境使用無限制 `*`。
- 錯誤訊息不得暴露 token、資料庫細節或內部 stack trace。

## 7. 費用與限制

- 本機 Worker + local D1 不需要付費。
- Cloudflare Workers Free 與 D1 Free 可先用於 MVP 評估，但仍需確認帳號與額度限制。
- 若需要 Workers Paid、超出 D1 免費額度、綁定信用卡或啟用任何付費功能，必須先取得使用者確認。
- 免費額度用盡時可能導致 API 失敗；不得將免費方案描述為無限制或保證永遠免費。

## 8. 待確認事項

- 是否正式採用 Cloudflare D1 取代 PostgreSQL。
- 是否長期保留 Firebase Authentication。
- 是否需要資料匯出與備份流程。
- 是否需要從 PostgreSQL 遷移既有資料至 D1。
- 正式環境允許的前端網域清單。
- 是否要建立一鍵啟動本機 Worker + 前端的 PowerShell script。
