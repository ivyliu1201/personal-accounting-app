# ARCHITECTURE.md

## 1. 目的

本文件記錄目前專案的架構遷移決策，避免在程式碼尚未完成前，將未完成的 Cloudflare Workers / D1 遷移誤視為已上線功能。

本文件不取代 `SPEC.md`。產品功能與登入行為仍以 `SPEC.md` 為準。

## 2. 目前狀態

- 前端：Vue 3。
- 後端：Java 21 + Spring Boot。
- 資料庫：PostgreSQL。
- 登入驗證：Firebase Authentication。
- 本機開發：Docker Compose 啟動 PostgreSQL、後端與前端。

## 3. 目標架構

下一階段目標是評估並逐步遷移至 Cloudflare 平台：

- 前端：Vue 3，後續可部署至 Cloudflare Pages 或 Workers Static Assets。
- 後端：Cloudflare Workers。
- 資料庫：Cloudflare D1。
- 登入驗證：暫定維持 Firebase Authentication。

## 4. 遷移原則

- 不一次重寫整個系統。
- 每次只遷移一個小範圍，並保留可驗證的回退點。
- 未完成 Workers API 前，不移除既有 Spring Boot 後端。
- 未完成 D1 schema 與資料驗證前，不移除既有 PostgreSQL migration。
- Firebase 登入暫時保留；若要改 Cloudflare Access，必須另行確認。
- 所有會產生費用、需要綁定信用卡或升級付費方案的操作，必須先取得使用者確認。

## 5. 建議遷移順序

1. 建立 Cloudflare Workers / D1 最小 POC。
2. 實作 Firebase ID token 驗證。
3. 建立 D1 schema，對齊現有 PostgreSQL 資料模型。
4. 先遷移低風險讀取 API，例如健康檢查與類別查詢。
5. 遷移新增帳目 API。
6. 遷移最近明細與歷史查詢 API。
7. 遷移統計圖表 API。
8. 遷移編輯與刪除 API。
9. 完成資料一致性驗證後，再評估停用 Spring Boot / PostgreSQL。

## 6. 資安要求

- D1 不得直接公開給前端存取，所有資料操作必須經由 Worker API。
- Worker API 必須驗證 Firebase ID token，不得只依賴前端登入狀態。
- 所有帳目、類別與統計查詢都必須以登入使用者 ID 隔離資料。
- 修改與刪除 API 必須同時檢查資料擁有者。
- Cloudflare 與 Firebase secrets 不得提交到 Git。
- secrets 必須使用 Cloudflare Secrets 或等效安全機制管理。
- CORS 必須限制允許來源，不得在正式環境使用無限制 `*`。
- 錯誤訊息不得暴露 token、資料庫細節或內部 stack trace。

## 7. 費用與限制

- Cloudflare Workers Free 可先用於 MVP 評估。
- Cloudflare D1 Free 可先用於 MVP 評估。
- 若需要 Workers Paid、超出 D1 免費額度、綁定信用卡或啟用任何付費功能，必須先取得使用者確認。
- 免費額度用盡時可能導致 API 失敗；不得將免費方案描述為無限制或保證永遠免費。

## 8. 待確認事項

- 是否正式採用 Cloudflare D1 取代 PostgreSQL。
- 是否長期保留 Firebase Authentication。
- 是否需要資料匯出與備份流程。
- 是否需要從 PostgreSQL 遷移既有資料至 D1。
- 正式環境允許的前端網域清單。
