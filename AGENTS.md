# AGENTS.md

## 1. 專案定位

- 本專案為個人記帳 Web App。
- 開發需以現有需求文件為唯一依據，不可自行擴充產品範圍。
- 本專案採 MVP 優先策略，先完成最小可行版本，再逐步擴充。

## 2. 必讀文件順序

AI agent 開始任何實作前，必須依序閱讀：

1. `SPEC.md`
2. `FLOW.md`
3. `WIREFRAME.md`
4. `skills/full-stack-java-spring.md`
5. `skills/java-code-rules.md`
6. `skills/step-confirmation.md`
7. `skills/test-reporting.md`

## 3. 文件用途

- `SPEC.md`：主要產品需求與功能規格，作為產品行為的唯一主要依據。
- `FLOW.md`：流程輔助文件，用於理解使用者操作流程與狀態轉換。
- `WIREFRAME.md`：版面輔助文件，用於理解頁面區塊與 UI 配置。
- `skills/full-stack-java-spring.md`：預設技術棧、Spring Boot 專案架構、專案初始化、依賴管理、環境變數、資料庫與 migration 規則。
- `skills/java-code-rules.md`：Java 程式碼層級硬規則，包含命名、常數、集合、泛型、並發、例外、資源管理、日誌、SQL / ORM 與註解規則。
- `skills/step-confirmation.md`：小步驟開發、實作前確認、完成後回報、TODO 與風險分級。
- `skills/test-reporting.md`：測試策略、測試指令、測試報告格式與測試失敗處理。

## 4. 文件優先順序

若文件內容衝突，優先順序為：

`SPEC.md > FLOW.md > WIREFRAME.md > skills/full-stack-java-spring.md > skills/java-code-rules.md > skills/step-confirmation.md > skills/test-reporting.md`

## 5. 衝突處理規則

- 若 `SPEC.md` 與 `FLOW.md` / `WIREFRAME.md` 衝突，以 `SPEC.md` 為準。
- `FLOW.md` 與 `WIREFRAME.md` 僅作為流程與版面輔助，不得覆蓋功能規格。
- 若任一 skill 與 `SPEC.md` 衝突，以 `SPEC.md` 為準。
- 若 `skills/full-stack-java-spring.md` 與 `skills/java-code-rules.md` 衝突：
  - 技術棧、Spring Boot 專案結構、依賴、環境變數、資料庫與 migration 以 `skills/full-stack-java-spring.md` 為準。
  - Java 程式碼寫法、命名、註解、集合、例外、日誌與 SQL / ORM 細節以 `skills/java-code-rules.md` 為準。
- 若 skill 之間出現本文件未定義的衝突，必須回報待確認事項，不得自行選邊。
- 若技術棧或程式規則無法支援 `SPEC.md` 中的需求，必須回報阻塞點與建議方案，不得自行修改產品需求。

## 6. 專案級開發限制

- 不得自行補需求。
- 不得偏離既有文件命名與頁面結構。
- 不得自行新增 `SPEC.md` 未定義的頁面、功能、外部服務或主要互動流程。
- 不得將 `SPEC.md` 未定義的功能描述為已完成。
- 遇到未定義行為時：
  - 先在程式中標記 `TODO`
  - 在交付回報中列出該未定義項目
  - 僅能以最小可行且不違反既有文件的方式暫時實作
- 若採用暫時方案，必須在程式碼與交付回報中都明確標示，不可假裝為最終設計。

## 7. 開發節奏與交付回報

- 本專案採小步驟開發。
- 每一步開始前、完成後與遇到阻塞時，皆依 `skills/step-confirmation.md` 執行。
- 測試選擇、測試執行與測試報告格式，依 `skills/test-reporting.md` 執行。
- 若本文件與 skill 對交付流程有衝突，以本文件的專案級限制為準；若是通用流程細節，以對應 skill 為準。

## 8. 未定義行為處理

- 本專案未定義的產品行為，不得自行擴充為正式功能。
- 未定義行為的暫時處理方式，需符合 `SPEC.md` 與 `skills/step-confirmation.md`。
- 若無法在不違反既有文件的前提下暫時處理，必須停止並回報待確認事項。