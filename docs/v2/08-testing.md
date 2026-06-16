# 測試 V2

## 1. 測試原則

- 未執行的測試不得描述為已通過。
- 不得隱藏失敗測試。
- build 與 type check 屬於交付品質的一部分。
- 無法用自動化測試覆蓋的 UI 行為，必須以人工驗證回報。

## 2. 前端檢查

Build：

```powershell
cd frontend
npm run build
```

日期格式測試：

```powershell
cd frontend
npm run test:date-format
```

建議覆蓋範圍：

- Firebase config 處理。
- 未登入時受保護操作。
- 批次表單驗證。
- 今日明細顯示。
- 歷史明細分頁。
- 編輯與刪除彈窗行為。
- 桌機與手機寬度的響應式版面。

## 3. Worker 檢查

Type check：

```powershell
cd worker
npm run typecheck
```

單元測試：

```powershell
cd worker
npm test
```

本機 Worker 已啟動時可執行 smoke test：

```powershell
cd worker
npm run smoke:local
```

建議覆蓋範圍：

- Firebase token 解析與登入失敗。
- 帳目驗證。
- 接受未來日期。
- 類別列表與自訂類別建立。
- 今日明細依類別排序。
- 歷史日期區間與分頁。
- 類別摘要。
- 年度現金流趨勢。
- 更新與刪除的資料歸屬檢查。

## 4. 人工驗證

人工驗證應包含：

- 未登入首頁版型與受保護操作提示。
- Google 登入。
- 批次新增成功與失敗。
- 首頁本月摘要更新。
- 今日明細展開與收合。
- 今日明細展開後的筆數切換。
- 歷史日期區間查詢。
- 歷史明細類型切換。
- 歷史甜甜圈圖模式切換。
- 編輯帳目。
- 刪除帳目與分頁行為。
- 桌機與手機 viewport 檢查。

## 5. 測試報告格式

變更後使用下列格式回報：

```md
## 測試報告

### 測試項目
- [ ] 前端 build
- [ ] 前端測試
- [ ] Worker type check
- [ ] Worker 測試
- [ ] Worker smoke test
- [ ] 人工驗證

### 指令
<已執行指令>

### 結果
通過：<數量或描述>
失敗：<數量或描述>
略過：<數量或描述>

### 覆蓋範圍
<驗證了哪些內容>

### 失敗項目
<失敗摘要或「無」>

### 未測項目
<未測項目與原因>
```
