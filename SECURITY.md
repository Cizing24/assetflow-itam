# 安全模型與邊界

## 驗證與 Session

- 密碼以 Argon2id hash 儲存；不回傳 hash，不把使用者輸入寫入一般日誌。
- 成功登入產生 32-byte 隨機 token，Cookie 是 bearer credential；資料庫僅保存其 SHA-256 digest。
- Session 是絕對到期，預設 8 小時，可設定 0.01–24 小時；不做無限滑動延長。
- 登入會旋轉同一瀏覽器舊 Session；登出在資料庫撤銷並清除 Cookie。
- 每次 API 查詢 Session、User active 與目前角色。角色／停用變更同一交易撤銷目標全部 Session。
- 本機 HTTP Cookie 為 HttpOnly、SameSite=Strict、Path=/；production 使用 Secure、`__Host-assetflow`，不設 Domain。
- production 若 APP_ORIGIN 不是 HTTPS，程序拒絕啟動。

## CSRF 與瀏覽器

所有 POST／PUT／PATCH／DELETE 都必須有與 APP_ORIGIN 完全相符的 Origin，包括登入。登入以外的寫入還需有效 Session 與 `X-CSRF-Token`，token 由登入或 `/api/auth/session` 提供，僅放前端記憶體。

API 是同源使用；沒有開放跨來源 CORS。SameSite 為額外防線，不能取代 Origin 與 CSRF 檢查。HTTP API 的非瀏覽器客戶端也必須送 Origin header。

Helmet 提供 CSP、frame-ancestors、nosniff 等安全標頭。腳本只允許 self，無第三方 CDN；style 允許 unsafe-inline 以支援由真實數據產生的圖表樣式。沒有使用 v-html 呈現業務資料。

## RBAC

| 能力                               | ADMIN | IT_STAFF | VIEWER |
| ---------------------------------- | ----- | -------- | ------ |
| 讀取資產、員工、統計、歷史與稽核   | ✓     | ✓        | ✓      |
| 建立／修改資產與員工               | ✓     | ✓        | —      |
| 領還、維修、除役、離職交接         | ✓     | ✓        | —      |
| 查看／建立／停用登入帳號及變更角色 | ✓     | —        | —      |
| 編輯／刪除 Audit Log               | —     | —        | —      |

後端 permission helper 決定權限，前端按鈕隱藏僅提供操作體驗。Viewer 可檢視整個單一工作空間，未實作逐資產或部門授權。至少保留一位 active ADMIN；帳號管理使用 transaction advisory lock 防並行降級。

## 輸入、資源與錯誤

Zod strict object 拒絕未定義的寫入欄位（如自行指定 status），驗證 UUID、有效日期、email、長度、非負價格與 enum。Fastify body 上限 32 KiB。列表 pageSize 最大 100，排序 allowlist，SQL 鎖定使用 tagged parameter query。

API 的 IP 限流預設每分鐘 300 次，登入每分鐘 10 次（測試模式提高登入上限供整合測試）。靜態 bundle 與健康檢查不消耗 API 配額，避免頁面刷新及 lazy loading 造成合法使用者被阻擋。沒有信任未設定代理的 X-Forwarded-For；若正式部署在反向代理後，必須明確評估 proxy trust 與限流鍵。

API 錯誤固定 `{ error: { code, message, requestId } }`。未知伺服器錯誤不傳 SQL／stack；日誌只記錯誤名稱、代碼與 requestId，避免 Prisma 的格式化訊息帶入查詢參數。Cookie、Authorization、CSRF 與 Set-Cookie 另有 redaction。API 回應 `Cache-Control: no-store`。

## 資料庫

部分唯一索引、FK、CHECK 與交易防止重複有效領用和半完成結果。稽核與業務同交易；append-only trigger 拒絕 UPDATE／DELETE。

本機開發使用同一個資料庫 owner 操作 Migration 與 runtime，以降低安裝門檻。正式環境應分為具 DDL 權限的 migrator 與只有必要 DML 的 runtime role，撤銷 AuditLog 的 UPDATE／DELETE／TRUNCATE 與 schema CREATE；不要給 runtime superuser。

## Secrets 與展示資料

`.env`、`.local`、測試輸出與 node_modules 都被忽略。`.env.example`、CI PostgreSQL 與測試字串是**隔離開發用合成憑證**。Seed 在 production 無條件拒絕，且需要 `DEMO_SEED=true`、至少 12 字元 DEMO_PASSWORD。既有帳號密碼不會因重跑 Seed 重設。

GitHub 交付 helper 從作業系統 Git Credential Manager 於記憶體取得憑證，沒有寫入檔案、參數、Git remote URL 或輸出。Repository 保持 Private。

## 正式部署前仍需做的事

本次沒有公開部署或正式環境資料。若未來授權上線，需另行規劃 TLS、正式帳號 provisioning、密碼重設／變更、備份還原演練、最小 DB role、受信 proxy、營運監控與失敗登入持久化、Session 定期清理、容量及災難復原。

沒有 MFA、SSO、密碼遺忘流程、獨立安全事件表或完整滲透測試。登入限流與 Argon2id 不等於通過安全認證。npm audit 的零已知漏洞僅代表當次公告資料庫結果，不能保證沒有未知漏洞。
