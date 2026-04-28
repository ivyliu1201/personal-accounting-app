# Full Stack Java Spring Skill

## 1. 目的

本文件定義本專案與未來預設專案可共用的全端技術棧、Spring Boot 專案架構、專案初始化、依賴管理、環境變數、資料庫與 migration 規則。

除非使用者在專案文件中另有指定，AI agent 應以本文件作為預設技術與 Spring Boot 專案實作基準。

本文件不重複定義 Java 程式碼細節、開發節奏或測試報告格式；相關規則依對應 skill 執行。

## 2. 與其他 skill 的邊界

- Java 程式碼層級規則依 `skills/java-code-rules.md` 執行。
- 開發節奏、事前確認、完成後回報與阻塞處理，依 `skills/step-confirmation.md` 執行。
- 測試選擇、測試執行與測試報告格式，依 `skills/test-reporting.md` 執行。
- 本文件只負責全端技術棧、Spring Boot 專案架構、依賴、環境、資料庫與 migration 規則。

若本文件與其他 skill 發生責任邊界不清：

- Java 語言、命名、註解、集合、例外、日誌、SQL / ORM 程式碼寫法，以 `skills/java-code-rules.md` 為準。
- Spring Boot 分層、專案初始化、依賴、環境變數、資料庫與 migration，以本文件為準。
- 交付流程與確認節奏，以 `skills/step-confirmation.md` 為準。
- 測試報告內容與格式，以 `skills/test-reporting.md` 為準。

## 3. 預設技術棧

所有專案預設使用以下技術棧：

- 開發環境：VS Code
- 版本控制：Git
- 套件管理工具：npm
- 執行環境：Docker
- 資料庫：PostgreSQL
- 前端：Vue 3 穩定版
- 後端：Java 21 + Spring Boot 4.x 穩定版
- 登入驗證：Firebase Authentication

## 4. 版本選型原則

- Java 使用 `21`。
- Vue 使用 `3` 穩定版。
- Spring Boot 使用 `4.x` 穩定版。
- 具體小版本可由 AI agent 選擇當下穩定版，但不得憑記憶或猜測版本。
- AI agent 在初始化專案或新增 / 調整核心依賴前，必須先確認所選版本為目前可用的穩定版本。
- 若 AI agent 無法確認目前可用的穩定版本，必須停止並回報為待確認事項，不得自行選擇版本。
- 每次交付時，若有選擇、新增或調整版本，必須在交付回報中說明：
  - 選擇的版本
  - 確認依據
  - 選擇理由
  - 可能影響範圍

## 5. 專案初始化要求

若專案尚未初始化，AI agent 必須建立或確認以下檔案：

- `package.json`
- `.env.example`
- `Dockerfile`
- `docker-compose.yml`

若需新增其他初始化檔案，必須先依 `skills/step-confirmation.md` 回報原因與影響範圍，並取得使用者確認。

## 6. 依賴與外部服務規則

- 若既有技術棧已可完成需求，不得額外引入新的雲端服務、SaaS 或重大技術依賴。
- 若確實需要額外技術，必須先：
  - 說明原因
  - 說明影響範圍
  - 取得使用者同意
- 若新增第三方套件或依賴，必須在交付回報中列出：
  - 新增了哪些套件
  - 新增原因
  - 影響範圍
- 不得為了方便實作而繞過既有專案文件定義的產品需求、技術棧或安全限制。

## 7. 環境變數規則

- 若新增環境變數，必須同步更新 `.env.example`。
- `.env.example` 不得放入真實密鑰、憑證或敏感資訊。
- 若某個環境變數用途未定義清楚，必須回報為待確認事項，不得自行假設。
- 涉及 Firebase、資料庫連線或第三方服務的環境變數，需在交付回報中說明用途與是否必填。

## 8. Spring Boot 分層原則

- Controller 只處理 HTTP request / response，不放核心業務邏輯。
- Service 處理業務邏輯、交易邊界與資料處理流程。
- Repository 處理資料存取。
- DTO 用於 API 輸入與輸出，不直接暴露 Entity。
- Entity 用於資料持久化模型，不承載複雜業務流程。
- 交易邏輯應放在 Service 層。
- 驗證邏輯應依責任分層放置：
  - 欄位格式與必填驗證可放在 DTO / request validation。
  - 跨欄位或業務規則驗證應放在 Service。

## 9. Java 程式碼規則

- Java 程式碼層級規則依 `skills/java-code-rules.md` 執行。
- 本文件不重複定義 Java 命名、常數、集合、例外、日誌、SQL / ORM 等細節。
- 若需要產生 Java class、method 或 function，必須遵守 `skills/java-code-rules.md` 中的註解規則。

## 10. Java / Spring Boot 測試策略

- 核心業務邏輯與資料處理採 TDD。
- Service 層核心邏輯優先使用單元測試。
- Repository 或 DB 行為可使用整合測試。
- Controller 可使用 MockMvc 或等價工具測試主要 API 行為。
- 測試資料需清楚、可讀，不得依賴真實使用者資料或真實密鑰。
- 測試執行選擇與測試報告格式，依 `skills/test-reporting.md` 執行。

## 11. 資料庫與 migration 規則

- 資料必須持久化保存。
- 若新增或修改資料表、欄位、索引或 migration，必須在交付回報中明確列出資料庫變更內容。
- migration 應可重複執行於乾淨環境。
- 不得在 migration 中放入真實敏感資料。
- 若資料庫設計與產品需求之間有未定義行為，必須回報待確認事項，不得自行擴充產品需求。

## 12. 技術棧變更規則

- AI agent 不得自行更換主要技術棧。
- 若需求無法由預設技術棧合理完成，必須先回報原因與替代方案。
- 未取得使用者同意前，不得進行重大技術棧變更。
- 不得因個人偏好、範例方便或框架預設而自行替換本文件指定的主要技術。

## 13. 與產品規格衝突時

若本文件與 `SPEC.md` 發生衝突，以 `SPEC.md` 為準。

若技術棧規則無法支援 `SPEC.md` 中的需求，AI agent 必須回報阻塞點與建議方案，不得自行修改產品需求。