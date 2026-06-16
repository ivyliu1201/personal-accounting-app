# 資料庫 V2

## 1. 資料庫

目前資料庫為 Supabase Postgres。

MVP 的資料模型刻意保持精簡：

- `categories`
- `accounting_transactions`

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

## 4. 預設類別

預設支出類別：

- 飲食
- 交通
- 投資
- 繳費
- 自我成長
- 社交
- 治裝費
- 運動

預設收入類別：

- 投資
- 薪資

## 5. 資料隔離

系統透過 `user_id` 隔離使用者資料。

Worker API 邏輯必須一律：

- 從已驗證 token 取得 Firebase uid。
- 使用 `user_id = current user id` 查詢帳目。
- 建立帳目時寫入 `user_id = current user id`。
- 更新或刪除時同時比對 `id` 與 `user_id`。

## 6. Schema 變更規則

任何 schema 變更都必須更新本文件；若 API contract 也改變，需同步更新 `04-api.md`。

Schema 變更不得引入未定義產品行為，除非先更新 `01-product-spec.md`。
