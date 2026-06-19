# 部署 V2

## 1. 部署目標

- 前端：Cloudflare Pages，透過 GitHub integration 從 `master` push 自動部署。
- 後端 API：Cloudflare Worker。
- 資料庫：Supabase Postgres。
- 登入驗證：Firebase Authentication。

## 2. Worker 部署

必要 Worker secrets 與變數以 `06-env.md` 為準。部署前需確認至少包含：

```text
FIREBASE_PROJECT_ID
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
APP_CORS_ALLOWED_ORIGINS
AI_CATEGORY_SERVICE_URL
AI_CATEGORY_SERVICE_TOKEN
```

部署：

```powershell
cd worker
npm run deploy
```

部署後，記錄 Worker URL，並作為前端的 `VITE_API_BASE_URL`。

`AI_CATEGORY_SERVICE_URL` 指向獨立部署的 AI 分類服務。`AI_CATEGORY_SERVICE_TOKEN` 應設定為 Worker secret，不得放入前端環境變數。

部署前驗證：

```powershell
cd worker
npm run typecheck
npm test
```

## 3. Supabase migration

部署 Worker 前，Supabase 必須已套用目前 schema：

- `worker/migrations/0002_create_ai_feedback_schema.sql`
- `worker/migrations/0003_grant_ai_feedback_privileges.sql`

若使用 Supabase Dashboard，可在 SQL Editor 執行 `0003` 的 grant SQL。未套用時，快速新增的 feedback 寫入會因權限不足失敗；帳目主資料仍會新增，但個人規則和訓練候選資料不會更新。

## 4. AI 分類服務部署

AI 分類服務位於獨立專案：

```text
C:\ivy\code\ai-accounting-category-api
```

正式部署目標為 Cloud Run。此服務只提供自然語句解析與模型標籤，記帳系統的使用者驗證、類別對應、資料庫寫入與 feedback 儲存仍由 Worker 負責。

部署前需在 AI API 專案執行：

```powershell
python -m unittest test_train.py
python train.py
python evaluate.py
```

只有通過評估的 `transaction_classifier.pth` 才能部署。`training_data.csv` 仍是目前全域模型訓練資料來源；`ai_quick_add_feedback` 需經篩選後才可加入訓練資料。

AI API 的模型檔目前包含主要分類器與 sparse embedding index。部署前需確認：

- `python -m unittest test_train.py` 通過。
- `python evaluate.py` 顯示 `errors=0` 且 `low_confidence=0`。
- `evaluation_data.csv` 需覆蓋主要類別與常見口語泛化案例，例如水果、買菜、薯條、運動月費、寵物與收入入帳描述。
- `transaction_classifier.pth` 是由最新 `training_data.csv` 重新訓練產生，不可部署舊模型檔。
- 中文 HTTP response 正常，不能出現 Windows terminal 測試時才會看到的 `????` 或 mojibake。

AI API 專案提供 `Dockerfile`。Cloud Run 部署範例：

```powershell
cd C:\ivy\code\ai-accounting-category-api
gcloud run deploy accounting-category-ai-api --source . --region asia-east1 --allow-unauthenticated --min-instances 0 --max-instances 2 --memory 1Gi --cpu 1
```

部署完成後，將 Cloud Run URL 設為 Worker 的 `AI_CATEGORY_SERVICE_URL`。正式 Worker 不可指向 `localhost` 或 `127.0.0.1`。

成本保護規則：

- Cloud Run `min-instances` 必須為 `0`，避免無流量時保溫計費。
- Cloud Run `max-instances` 建議維持 `2`，避免異常流量造成成本暴衝。
- AI 訓練由本機手動執行，不在 Cloud Run 內排程訓練。
- 每週重新訓練與重新部署後，需清理舊 Cloud Run revision 或確認舊 revision 已無流量。
- Artifact Registry 需設定 cleanup policy，只保留必要的新版本，避免 PyTorch image 長期累積 storage 費。
- Google Cloud Billing 應設定 budget alert，建議 `US$3`，通知門檻 `50%`、`90%`、`100%`。

## 5. 前端部署

前端正式部署主線使用 Cloudflare Pages GitHub integration。

GitHub repository：

```text
https://github.com/ivyliu1201/personal-accounting-app
```

Cloudflare Pages 設定：

| 項目 | 值 |
|---|---|
| Production branch | `master` |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |

Cloudflare Pages 環境變數需依 `06-env.md` 設定，至少包含：

```text
VITE_API_BASE_URL=https://<worker-domain>
VITE_FIREBASE_API_KEY=<firebase-web-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
VITE_FIREBASE_PROJECT_ID=<firebase-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<firebase-storage-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<firebase-sender-id>
VITE_FIREBASE_APP_ID=<firebase-app-id>
```

設定完成後，push 到 GitHub `master` branch 會由 Cloudflare Pages 自動執行 build 與部署。

本機部署前驗證仍可執行：

```powershell
cd frontend
npm run build
```

除非 Cloudflare Pages GitHub integration 暫時不可用，否則不使用 Wrangler direct upload 作為正式前端部署主線。

## 6. Firebase 設定

正式前端網域必須加入 Firebase Authentication 允許網域。

部署後需在正式前端網域測試 Google 登入。

## 7. CORS

Worker 的 `APP_CORS_ALLOWED_ORIGINS` 必須包含 Cloudflare Pages 前端 origin。

範例：

```text
https://personal-accounting-frontend.pages.dev
```

## 8. 部署驗證

部署後：

- 開啟前端 URL。
- 確認未登入首頁可載入。
- 使用 Google 登入。
- 確認 `/api/auth/me` 成功。
- 確認今日明細可載入。
- 若使用測試帳號，建立一筆小額測試帳目。
- 測試快速新增解析、修改 AI 分類後送出、再次輸入相似文字確認個人規則生效。
- 確認首頁與歷史查看可更新。
