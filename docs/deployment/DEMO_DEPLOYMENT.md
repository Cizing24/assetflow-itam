# AssetFlow 公開 Demo 部署

狀態：部署準備中，尚無已驗收的公開 URL。日期：2026-11-14。分支：`codex/demo-deployment-2026-11-14`。

採 Render Free Docker 單一 Fastify 同源入口，連到獨立 Neon Free PostgreSQL 18 的 Demo branch。Render 終止 HTTPS；資料不寫入容器本機。`render.yaml` 停用自動發布，僅從 Demo 分支手動部署通過 CI 的 SHA。

環境名稱及安全佔位符見 `.env.demo.example`。Web 僅需 `NODE_ENV`、`DEPLOYMENT_ENV`、`DATABASE_URL`、`APP_ORIGIN`、`HOST`、`PORT`、`SESSION_HOURS`。Web 使用 `assetflow_runtime`；Migration／Provision 密碼不得放入 Web 環境。

1. 建立獨立 PostgreSQL 專案及 `assetflow_demo`，使用直連、驗證憑證的 TLS URL 執行 Migration。先在隔離分支驗證，已有資料時先以同 major `pg_dump` 備份。
2. 在受保護工作階段注入 migrator `DATABASE_URL` 與 `.env.demo.example` 的 provisioning 變數；分別產生至少 24 字元的三個帳號密碼。`APP_ORIGIN` 必須 HTTPS，`DEMO_DATABASE_HOST` 必須與直連 host 相符。
3. 執行 `npm ci`、`npm run db:generate`、`npm run db:migrate`、`npm run demo:provision`。佈建核對實際 DB 名稱，拒絕已存在的 User／Asset／AuditLog；不清表、不重設密碼。原始 `db:seed` 的 production 禁令保留。
4. 注入 `DEMO_RUNTIME_PASSWORD`，用 psql 執行 `scripts/demo-runtime-role.sql`。它建立無 DDL、無 migration table 權限且不能更動稽核的 runtime role。腳本只供新 DB 執行一次；後續 Migration 要明確補授新增表權限。
5. Web 改用 runtime 的 pooled URL；Render 設定實際分配的 HTTPS `APP_ORIGIN`。只有公開 VIEWER 密碼可作為 Docker build arg `VITE_DEMO_VIEWER_PASSWORD`，瀏覽器會看到它；禁止使用 IT／ADMIN 密碼或 migrator URL 作為 build args。
6. 部署通過 CI 的精確 SHA，測 `/health`、首頁及 API；再執行 operations 文件列出的完整 smoke。記錄實際 URL、版本、映像 digest、Cookie／Origin／403、持久化與冷啟動結果。

Render Free 每 workspace 共享每月 750 執行時數，閒置 15 分鐘休眠且沒有持久磁碟。此帳戶已有兩個服務且本月時數接近上限，可能暫停；不移除舊服務、不加卡或自動升級。Neon Free 配額也可能造成停用；平台當期限制見 [官方 Render Free](https://render.com/docs/free) 與 [Neon 價格](https://neon.com/pricing)。

未取得完整公網驗收前，不更新 Portfolio Live Demo 連結，也不把資料庫建立當成網站成功上線。
