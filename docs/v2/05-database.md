# 資料庫 V2

## 1. 資料庫

目前資料庫為 Supabase Postgres。

MVP 的資料模型刻意保持精簡：

- `categories`
- `accounting_transactions`
- `ai_quick_add_feedback`

## 2. `categories`

用途：儲存預設與自訂類別名稱。

欄位：

- `id`：主鍵。
- `user_id`：擁有者使用者 ID。`null` 代表共用預設類別。
- `type`：`INCOME` 或 `EXPENSE`。
- `name`：類別顯示名稱。
- `default_category`：是否為預設類別。
- `created_at`：建立時間。

規則：

- 預設類別使用 `user_id = null`。
- 自訂類別使用目前 Firebase uid 作為 `user_id`。
- 相同 `user_id`、`type`、`name` 必須唯一。
- 收入與支出可使用相同類別名稱，因為兩者類型不同。

## 3. `accounting_transactions`

用途：儲存使用者帳目。

欄位：

- `id`：主鍵。
- `user_id`：擁有者的 Firebase uid。
- `type`：`INCOME` 或 `EXPENSE`。
- `transaction_date`：使用者輸入的帳目日期。
- `amount`：正數金額。
- `category_id`：參照 `categories.id`。
- `note`：選填備註。
- `created_at`：系統產生的建立時間。

規則：

- `amount` 必須大於 0。
- 每筆帳目屬於一位使用者。
- 查詢必須包含目前使用者範圍。
- 首頁今日明細以 `transaction_date` 篩選今天資料，並依類別名稱排序；同類別內依 `created_at desc` 排序。
- 歷史查看列表依 `transaction_date desc`，再依 `created_at desc` 排序。

## 4. `ai_quick_add_feedback`

用途：儲存 AI 快速新增建議與使用者最後送出的帳目差異，供後續模型訓練資料篩選使用。

欄位：

- `id`：主鍵。
- `user_id`：擁有者的 Firebase uid。
- `transaction_id`：對應成功建立的帳目 ID。
- `quick_add_session_id`：同一次快速新增流程的 session ID。
- `quick_add_input_text`：使用者原始快速新增輸入文字。
- `feedback_type`：`accepted`、`corrected` 或 `missed_by_ai`。
- `suggestion_id`：AI 建議 ID；AI 漏掉、使用者手動補列時可為 `null`。
- `source_text`：AI 建議來源文字片段。
- `item_text`：AI 建議的項目文字。
- `model_label`：AI 模型輸出的原始標籤。
- `model_type`：AI 模型判斷的類型。
- `model_category`：AI 模型判斷的類別。
- `mapped_type`：Worker 對應到記帳系統後的類型。
- `mapped_category_name`：Worker 對應到記帳系統後的類別。
- `final_type`：使用者最後送出的類型。
- `final_category`：使用者最後送出的類別。
- `final_amount`：使用者最後送出的金額。
- `final_transaction_date`：使用者最後送出的帳目日期。
- `final_note`：使用者最後送出的備註。
- `confidence`：AI 建議信心分數。
- `needs_review`：AI 建議是否需要使用者確認。
- `date_source`：日期來源，例如相對日期、明確日期或預設今天。
- `mapping_source`：類別映射來源，例如使用者映射、全域映射、完全相符或建議自訂類別。
- `created_at`：回饋建立時間。

規則：

- 每筆回饋都屬於一位使用者，必須用 `user_id` 隔離。
- `accepted` 表示 AI 建議與使用者最後送出的類型、日期、金額、類別與備註一致。
- `corrected` 表示該列來自 AI 建議，但使用者送出前有修改。
- `missed_by_ai` 表示該列是在快速新增 session 中由使用者手動補上，沒有對應 AI 建議。
- 一般手動批次新增不寫入本表。
- `corrected` 回饋可作為同一使用者後續快速新增的即時個人修正規則；只有成功建立帳目後寫入的回饋可被使用，避免新增失敗資料污染規則與訓練資料。

## 5. 預設類別

預設支出類別：

- 飲食
- 交通
- 投資
- 繳費
- 自我成長
- 娛樂
- 治裝費
- 運動

預設收入類別：

- 投資
- 薪資

## 6. 資料隔離

系統透過 `user_id` 隔離使用者資料。

Worker API 邏輯必須一律：

- 從已驗證 token 取得 Firebase uid。
- 使用 `user_id = current user id` 查詢帳目。
- 建立帳目時寫入 `user_id = current user id`。
- 更新或刪除時同時比對 `id` 與 `user_id`。

## 7. Schema 變更規則

任何 schema 變更都必須更新本文件；若 API contract 也改變，需同步更新 `04-api.md`。

Schema 變更不得引入未定義產品行為，除非先更新 `01-product-spec.md`。
