# AGENTS V2

## 1. 文件目的

本文件是專案級 AI 協作指示的 V2 版本。

V2 開發工作應以本文件作為目前 AI 協作規則。

## 2. 專案定位

- 本專案是個人記帳 Web App。
- 採 MVP 優先。
- 產品範圍只以 V2 產品文件定義。
- 不得新增 `01-product-spec.md` 未定義的產品功能。

## 3. V2 文件用途

V2 文件各自用途如下：

- `docs/v2/00-current-status.md`
  - V2 文件入口。
  - 說明目前系統真實狀態、主架構、主要目錄與一般閱讀入口。

- `docs/v2/01-product-spec.md`
  - 產品需求主文件。
  - 定義 MVP 功能、頁面、欄位、登入權限、首頁、歷史查看、類別、錯誤與空狀態。

- `docs/v2/02-wireframe.md`
  - 低保真版面文件。
  - 說明首頁、歷史查看、編輯彈窗與刪除確認彈窗的區塊配置。

- `docs/v2/03-architecture.md`
  - 系統架構文件。
  - 定義目前主線為 Vue 3 前端、Cloudflare Worker API、Supabase Postgres 與 Firebase Authentication。

- `docs/v2/04-api.md`
  - API 契約文件。
  - 記錄 `/api/...` routes、查詢參數、請求內容、回應內容與登入需求。

- `docs/v2/05-database.md`
  - 資料庫文件。
  - 說明 `categories`、`accounting_transactions` 資料表、欄位、規則與使用者資料隔離。

- `docs/v2/06-env.md`
  - 環境變數文件。
  - 區分前端變數、Worker secrets、本機與正式環境設定。

- `docs/v2/07-development.md`
  - 本機開發文件。
  - 說明建議開發路徑、安裝依賴、啟動 Worker、啟動前端與開發規則。

- `docs/v2/08-testing.md`
  - 測試文件。
  - 說明前端 build/test、Worker typecheck/test、人工驗證項目與測試報告格式。

- `docs/v2/09-deployment.md`
  - 部署文件。
  - 說明 Cloudflare Worker、Cloudflare Pages、Firebase、CORS 與部署後驗證。

- `docs/v2/AGENTS.md`
  - AI 協作規則文件。
  - 定義 AI 必讀順序、目前架構規則、範圍控制、實作節奏、測試與 Git 規則。

## 4. 必讀文件順序

AI agent 開始實作前必須閱讀：

1. `docs/v2/00-current-status.md`
2. `docs/v2/01-product-spec.md`
3. `docs/v2/02-wireframe.md`
4. `docs/v2/03-architecture.md`
5. `docs/v2/04-api.md`
6. `docs/v2/05-database.md`
7. `docs/v2/06-env.md`
8. `docs/v2/07-development.md`
9. `docs/v2/08-testing.md`
10. `docs/v2/09-deployment.md`
11. `docs/v2/AGENTS.md`

## 5. 目前架構規則

目前後端架構是 Cloudflare Worker + Supabase Postgres。

除非先更新 `03-architecture.md`，否則 AI agent 不得把其他後端路徑視為 V2 目前執行架構。

## 6. 檔案編碼規則

- 文字檔一律以 UTF-8 讀寫。
- 若檔案出現亂碼或無法正確解析，必須停止並回報。
- 不得猜測損毀內容。

## 7. 範圍控制

AI agent 不得：

- 新增產品規格未定義的頁面。
- 新增產品規格未定義的主要流程。
- 未經確認新增外部服務。
- 未經確認更換登入驗證服務。
- 未經確認更換資料庫服務。
- 將服務密鑰放入前端檔案。
- 將暫時行為描述為最終行為。

遇到未定義行為時：

- 若有修改程式碼，需在程式碼標記 TODO。
- 在交付回報中列出。
- 採用不違反 V2 文件的最小實作。

## 8. 實作節奏

本專案採小步驟開發。

修改檔案前需回報：

- 本步目標。
- 預計修改檔案。
- 預期行為變更。
- API 影響。
- 資料庫影響。
- 環境變數影響。
- 測試計畫。
- 不處理範圍。

修改檔案後需回報：

- 變更摘要。
- 已修改檔案。
- 已完成項目。
- 未完成項目。
- 資料庫變更。
- 環境變數變更。
- 文件變更。
- TODO 與風險等級。
- 測試報告。

## 9. 文件版控規則

若 AI agent 發現「V2 文件描述」與「目前程式碼、部署設定、資料庫、環境變數或實際功能」不一致，且可能誤導後續開發，必須處理文件版控。

處理方式：

- 若本步工作本來就包含相關修改，需同步更新對應 V2 文件。
- 若本步工作不包含文件修改，需停止擴大實作並在回報中列為待確認事項。
- 若差異會造成 AI 選錯架構、改錯 API、誤用資料庫、漏測或錯誤部署，需標示為高風險。
- 不得只依程式碼推翻文件，也不得只依文件忽略實際系統狀態。

對應文件：

- 架構或部署路徑：`03-architecture.md`、`09-deployment.md`、必要時 `00-current-status.md`。
- 產品功能或行為：`01-product-spec.md`、必要時 `02-wireframe.md`。
- API contract：`04-api.md`。
- 資料庫 schema 或資料隔離：`05-database.md`。
- 環境變數：`06-env.md` 與 `.env.example`。
- 本機開發方式：`07-development.md`。
- 測試方式：`08-testing.md`。
- AI 協作規則：`AGENTS.md`。

交付回報中需明確說明：

- 發現了哪些文件與實作不一致。
- 已更新哪些文件，或為何暫未更新。
- 若暫未更新，可能誤導的範圍與建議下一步。

## 10. 測試規則

依 `08-testing.md` 執行。

不得把未執行測試描述為通過。

若無法執行測試，需回報：

- 哪些測試未執行。
- 未執行原因。
- 風險。
- 建議補測方式。

## 11. 前端規則

前端變更需：

- 保留 `01-product-spec.md` 定義的所有必要欄位與操作。
- 維持桌機與手機可用性。
- 不得為了視覺簡化移除產品欄位。
- 若改動響應式行為，需回報已驗證 viewport。

## 12. API 與資料庫規則

Worker API 變更需：

- 保持 route 在 `/api/...`。
- 受保護操作需先驗證 Firebase token。
- 使用 Firebase uid 限制使用者資料。
- 回傳對使用者安全的錯誤訊息。
- API contract 改變時更新 `04-api.md`。

資料庫變更需：

- 更新 `05-database.md`。
- 明確維持使用者資料隔離。
- 不得為未定義產品行為新增 schema 欄位。

## 13. Git 規則

- 實作前檢查工作區狀態。
- 不得覆蓋使用者無關變更。
- 未經使用者確認不得自行 commit。
- commit 只應包含本步相關變更。
