# AssetFlow Demo 維運

公開帳號為 `viewer@assetflow.example.test`（VIEWER）；密碼由受保護部署設定注入並刻意公開於登入表單。`it@assetflow.example.test`、`admin@assetflow.example.test` 僅提供操作者，分開保管密碼。資料全部合成，公開訪客不能編輯或建立員工／設備。

## 驗收

- 外部 HTTPS 瀏覽器成功／失敗登入，確認 `__Host-assetflow` 的 Secure、HttpOnly、SameSite=Strict；不回傳 passwordHash。
- 無 Origin、錯誤 Origin、缺少 CSRF 的寫入應拒絕。VIEWER 寫入 403，IT 管理使用者 403。
- 受控 IT 完成設備領用→讀回 ASSIGNED→歸還→讀回 AVAILABLE；另測故障歸還→維修→修復，以及離職尚有設備時禁止結案、歸還後可結案。稽核同交易保存。
- 重啟 Web 後資料仍在；DB 不可用時健康檢查失敗且應用不洩漏內部錯誤。閒置 15 分鐘後從外部測冷啟動。
- 桌面、平板、390／320 px、鍵盤；檢查 `.env`、debug／stack、錯誤靜態路徑、內部 DB port 不可公開。

## 重置、保存與備份

公開訪客唯讀，無訪客業務輸入保留問題。每月由操作者確認資料量與展示情境；需要重置時建立新的獨立 Neon project／DB，重新 provision、驗收、切換 Secrets。舊 DB 至少保留 7 天且先備份；不刪除 AuditLog，不執行 TRUNCATE、reset 或清除 volumes。

到期 Session 在使用者下次登入時清理；每週檢查 Session 數量，必要時由營運 DB 工作只清理已到期 Session，不能刪稽核。公開共享 VIEWER 的登入限流採代理後共享 bucket，是保守的已知限制。

備份使用 direct migrator URL 與 PostgreSQL 18 `pg_dump --format=custom --no-owner --no-acl`；以 PGSERVICE／PGPASSFILE 注入，檔案限制權限、加密保存。還原到新 DB，核對核心數量與 AuditLog append-only trigger，再以受控帳號驗證；不要覆寫原 DB。免費平台歷史窗口不能取代備份。

## 更新與停止

更新先通過原有 CI，備份、執行一次 backward-compatible Migration，手動發布 Demo 分支 SHA。回滾到上一個驗收版本，保留新增 schema，不自動執行 down migration。Render Free 只保留有限的舊版本，另保留 Git SHA 和可重建映像。

停止展示可在 Render 手動 Suspend 該 Demo；資料庫仍保留。刪除服務／DB 是額外的不可逆資源操作，需先確認備份與使用者決定。監控 `/health`、5xx／429、DB 配額與共享時數；健康探測本身會消耗免費計算量，不用 ping 規避平台休眠。
