# API V2

## 1. 通用規則

Base path：

```text
/api
```

受保護 route 需要：

```text
Authorization: Bearer <Firebase ID token>
```

JSON response 使用：

```text
Content-Type: application/json; charset=utf-8
Cache-Control: no-store
```

錯誤 response：

```json
{
  "message": "錯誤訊息"
}
```

## 2. 健康檢查

### `GET /api/health`

用途：健康檢查。

回應內容：

```json
{
  "status": "ok",
  "service": "personal-accounting-worker"
}
```

## 3. 登入使用者

### `GET /api/auth/me`

用途：回傳目前已驗證使用者。

需要登入：是。

回應內容：

```json
{
  "userId": "firebase-uid",
  "email": "user@example.com"
}
```

## 4. 類別

### `GET /api/transactions/categories?type=EXPENSE`

用途：列出目前使用者在指定類型下可使用的類別名稱。

需要登入：是。

查詢參數：

- `type`：`EXPENSE` 或 `INCOME`。

回應內容：

```json
[
  {
    "name": "飲食"
  }
]
```

## 5. 批次新增帳目

### `POST /api/transactions/batch`

用途：從批次新增表單建立一筆或多筆帳目。

需要登入：是。

請求內容：

```json
{
  "transactions": [
    {
      "type": "EXPENSE",
      "transactionDate": "2026-05-05",
      "amount": 300,
      "categoryName": "飲食",
      "note": "午餐"
    }
  ]
}
```

回應內容：

```json
{
  "transactions": [
    {
      "id": "uuid",
      "type": "EXPENSE",
      "transactionDate": "2026-05-05",
      "amount": 300,
      "categoryName": "飲食",
      "note": "午餐",
      "createdAt": "2026-05-05T12:00:00.000Z"
    }
  ]
}
```

## 6. 今日明細

### `GET /api/transactions/recent?limit=5`

用途：列出今天的帳目。

需要登入：是。

查詢參數：

- `limit`：選填。預設 `5`，最大 `15`。

規則：

- 只回傳帳目日期為今天的資料。
- 依類別排序，同類別內依建立時間由新到舊排序。

回應內容：

```json
[
  {
    "id": "uuid",
    "type": "EXPENSE",
    "transactionDate": "2026-05-05",
    "amount": 300,
    "categoryName": "飲食",
    "note": "午餐",
    "createdAt": "2026-05-05T12:00:00.000Z"
  }
]
```

## 7. 歷史明細

### `GET /api/transactions/history`

用途：依類型與日期區間列出帳目。

需要登入：是。

查詢參數：

- `type`：`EXPENSE` 或 `INCOME`。
- `startDate`：`YYYY-MM-DD`。
- `endDate`：`YYYY-MM-DD`。
- `page`：選填，從 0 開始。
- `size`：選填。預設 `10`，最大 `20`。

回應內容：

```json
{
  "transactions": [
    {
      "id": "uuid",
      "type": "EXPENSE",
      "transactionDate": "2026-05-05",
      "amount": 300,
      "categoryName": "飲食",
      "note": "午餐",
      "createdAt": "2026-05-05T12:00:00.000Z"
    }
  ],
  "page": 0,
  "size": 10,
  "hasNext": false
}
```

## 8. 類別摘要

### `GET /api/transactions/category-summary`

用途：列出類別金額與占比。

需要登入：是。

查詢參數：

- `type`：`EXPENSE` 或 `INCOME`。
- `startDate`：選填，`YYYY-MM-DD`。
- `endDate`：選填，`YYYY-MM-DD`。

規則：

- 若兩個日期都未提供，預設範圍為本月第一天到今天。
- 若只提供其中一個日期，另一個日期也必填。

回應內容：

```json
[
  {
    "categoryName": "飲食",
    "amount": 300,
    "percentage": 100
  }
]
```

## 9. 年度現金流趨勢

### `GET /api/transactions/cash-flow-trend?year=2026`

用途：列出某一年每月淨現金流與累積現金流。

需要登入：是。

查詢參數：

- `year`：選填整數。預設為今年。

回應內容：

```json
[
  {
    "label": "2026-01",
    "amount": 1000,
    "cumulativeAmount": 1000
  }
]
```

## 10. 更新帳目

### `PUT /api/transactions/{id}`

用途：更新目前使用者擁有的一筆帳目。

需要登入：是。

請求內容：

```json
{
  "type": "EXPENSE",
  "transactionDate": "2026-05-05",
  "amount": 300,
  "categoryName": "飲食",
  "note": "更新後備註"
}
```

回應內容：`TransactionResponse`。

## 11. 刪除帳目

### `DELETE /api/transactions/{id}`

用途：刪除目前使用者擁有的一筆帳目。

需要登入：是。

回應內容：

```json
{}
```
