# AssetFlow

**IT Asset Lifecycle Management Platform — 從領用到交接，每一步都有依據。**

供中小型企業 IT 團隊使用的資產生命週期管理平台。Vue 3 前端透過 Fastify REST API 操作真正的 PostgreSQL；設備領還、維修、員工離職交接與稽核事件在同一資料庫交易內完成。

這是本機／隔離展示用途的作品集專案，沒有公開網站部署。示範員工與設備全部為合成資料。

![工作總覽](docs/screenshots/dashboard-desktop.png)

## 能展示什麼

- 登入、登出、伺服器端 Session、到期處理、CSRF 與三種角色的後端 RBAC。
- 資產與員工建立、編輯、詳情、搜尋、組合篩選、排序、分頁及歷史。
- 領用與正常／故障歸還；故障歸還同時建立維修。
- 維修進度、修復後恢復可借出，或無法修復時除役。
- 離職交接自動列出未歸還設備；全部歸還且明確確認實際離職日期後才能結案，並將員工標記為已離職；預計日與交接完成時間分開保存。
- 不可任意修改的 Audit Log、真實資料統計 Dashboard、桌面與手機介面。
- 真實 PostgreSQL 並行測試：8 個借出請求最多一筆成功；稽核失敗時整筆交易回滾。

![資產列表](docs/screenshots/assets.png)
![離職交接](docs/screenshots/offboarding.png)

## 技術與版本

Lockfile 固定實際安裝版本；以下為本次開發使用的主要版本。

| 層次      | 技術                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------- |
| Runtime   | Node.js 22 LTS（本機 22.23.1）／npm 10.9.8                                                         |
| Frontend  | Vue 3.5.44、TypeScript 5.9.3 strict、Vite 8.3.5、Vue Router 4.6.4、Pinia 3.0.4、Tailwind CSS 4.3.3 |
| Backend   | Fastify 5.12.7、Zod 4.6.7、Argon2id                                                                |
| Database  | PostgreSQL 18（本機 18.4）、Prisma 7.10.1、PostgreSQL driver adapter                               |
| Quality   | Vitest 5.0.5、Vue Test Utils 2.5.1、Playwright 1.64.1、ESLint 9                                    |
| Packaging | npm workspaces、Docker Compose、GitHub Actions                                                     |

## Windows 本機啟動

需求：Node.js >=22.12、npm、Git、PostgreSQL 18。可將 PostgreSQL bin 路徑設定在 `$env:PG_BIN`；預設為 `C:\Program Files\PostgreSQL\18\bin`。

```powershell
git clone https://github.com/Cizing24/assetflow-itam.git
cd assetflow-itam
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run db:local
npm.cmd run db:generate
npm.cmd run build -w @assetflow/shared
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run dev
```

開啟 [http://localhost:5173](http://localhost:5173)。API 為 `127.0.0.1:3001`，Vite 代理 `/api`；請使用與 `APP_ORIGIN` 相同的 `localhost` 名稱登入。健康檢查：[http://localhost:3001/health](http://localhost:3001/health)。

`db:local` 在 **本專案 `.local/postgres`** 初始化獨立資料目錄，僅監聽 `127.0.0.1:55432`，建立 `assetflow` 與 `assetflow_test`，不使用系統既有的 5432 資料庫。

停止前後端：執行中的終端按 Ctrl+C。停止本專案 PostgreSQL：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/local-db.ps1 -Stop
```

## 隔離展示帳號

僅在 `DEMO_SEED=true`、非 production 且明確提供 `DEMO_PASSWORD` 時才可執行 Seed。

| Email                    | 角色     | 使用方式                         |
| ------------------------ | -------- | -------------------------------- |
| `admin@assetflow.local`  | ADMIN    | 資產、員工、所有流程與使用者權限 |
| `it@assetflow.local`     | IT_STAFF | 資產、員工、領還、維修與交接     |
| `viewer@assetflow.local` | VIEWER   | 唯讀                             |

三個帳號的初始密碼取自你本機 `.env` 的 `DEMO_PASSWORD`。`.env.example` 含有**僅限本機的示範值**，不是正式環境預設憑證。不要沿用到正式環境。

Seed 可重複執行，建立約 20 名員工、50 項資產、多種狀態與歷史；既有資料、已變更的狀態與密碼不會被重設。E2E 會新增明確帶有 `E2E-`／`測試員工` 標記的合成紀錄，並保留其業務歷史。

## Docker Compose 展示

需求：Docker Engine／Docker Desktop 與 Compose v2。資料庫不對主機公開 port，app 僅綁定 loopback。

```powershell
$env:POSTGRES_PASSWORD = 'choose-a-local-demo-password'
$env:APP_ORIGIN = 'http://localhost:3001'
$env:DEMO_SEED = 'true'
$env:DEMO_PASSWORD = 'choose-a-12-character-demo-password'
docker compose up --build -d --wait
docker compose exec app npm run db:seed
```

開啟 [http://localhost:3001](http://localhost:3001)。Compose 啟動時會先等待 PostgreSQL，再套用 Migration，並以 `/health` 確認 app 可連線。重啟容器保留 named volume 中的資料。一般停止使用 `docker compose down`，**不要加 `-v`，除非你確實要刪除展示資料**。

Compose 明確使用 development 模式以支援 loopback HTTP 展示。正式 HTTPS 部署另見 [SECURITY.md](SECURITY.md)；本專案沒有執行公開部署。

## 測試與建置

先啟動 PostgreSQL，再對獨立測試庫套用 Migration：

```powershell
$savedDatabaseUrl = $env:DATABASE_URL
$env:DATABASE_URL = 'postgresql://assetflow:assetflow_local_only@127.0.0.1:55432/assetflow_test?schema=public'
npm.cmd run db:migrate
if ($null -eq $savedDatabaseUrl) { Remove-Item Env:DATABASE_URL } else { $env:DATABASE_URL = $savedDatabaseUrl }
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:api
npm.cmd run build
npx.cmd playwright install chromium
# 啟動並 Seed 隔離展示資料庫後；Playwright 可自行啟動 dev server。
npm.cmd run test:e2e
npm.cmd audit --audit-level=moderate
```

`TEST_DATABASE_URL` 必須指向名稱以 `_test` 結尾的專用資料庫。API 測試會清空該資料庫的業務表格，拒絕非測試名稱。測試不會清空開發展示庫。請勿將任何測試 URL 指向正式環境。

所有真實執行結果、失敗修正與尚未覆蓋的範圍見 [TESTING.md](TESTING.md)。CI workflow 包含 PostgreSQL service、單元／API／E2E／Build、安全稽核及另一個 Docker Compose smoke job。

正式編譯後的本機展示可使用單一 Node 程序：

```powershell
$env:APP_ORIGIN = 'http://localhost:3001'
npm.cmd start
```

前端靜態檔與 API 由 Fastify 同源提供。此指令仍需有效 `DATABASE_URL` 與已完成的 Migration。

## 文件與閱讀順序

1. [ARCHITECTURE.md](ARCHITECTURE.md)：結構、資料流與入口。
2. [DATABASE_DESIGN.md](DATABASE_DESIGN.md)：ERD、索引、交易、SQL 約束。
3. [BUSINESS_RULES.md](BUSINESS_RULES.md)：狀態機與競態。
4. [DECISIONS.md](DECISIONS.md)：選型、替代方案與限制。
5. [SECURITY.md](SECURITY.md)：Session、CSRF、RBAC 與正式環境邊界。
6. [API.md](API.md)：端點、範例與錯誤契約；[生成的 OpenAPI](docs/openapi.json)。
7. [TESTING.md](TESTING.md)：可重現測試與證據。
8. [docs/PROGRESS.md](docs/PROGRESS.md)：實作階段與驗收狀態。

優先閱讀原始碼：`schema.prisma` → 自訂 Migration → `src/db.ts` → `services/lifecycle.ts` → `auth.ts` → `routes.ts` → `integration.test.ts` → `web/src/api/client.ts` → `stores/auth.ts` → `router.ts` → `Offboarding.vue` → E2E。

## 第一版限制

單一企業工作空間；沒有多租戶、郵件、忘記密碼、檔案上傳、QR Code、SSO 或正式營運監控。分類與部門由 Seed／資料庫管理，不提供獨立編輯 UI。歷史查詢在詳情頁完整顯示、資產稽核時間軸最多載入 100 筆，可在全域稽核頁分頁查詢。所有 VIEWER 具有工作空間內相同的唯讀權限，未實作部門級資料隔離。

本版本不提供一般刪除，資產透過除役、員工透過交接後停用、登入帳號透過停用保留歷史。稽核表禁止 UPDATE／DELETE，但資料庫 owner 仍具備管理權限，正式環境必須另外配置最小權限 runtime DB role 與備份。
