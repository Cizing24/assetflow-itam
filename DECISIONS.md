# Architecture Decision Records

## ADR-001：採用 npm workspaces 的模組化單體

**決策**：Vue web、Fastify api、少量 shared 契約位於同一 repository；一個 PostgreSQL。

**理由**：作品集需完整呈現領還與交接一致性；一個交易邊界比多服務協調更容易驗證。npm workspaces 足以處理三個套件，沒有引入 Nx／Turborepo 的必要。

**替代方案**：微服務、各自獨立 repository、BaaS。前兩者增加部署與分散式一致性成本；BaaS 不符合真正 Fastify API 與 PostgreSQL 交易展示目標。

**取捨**：尚未為大型組織拆出服務；目前數十員工／數百設備的規模可由單體有效服務。

## ADR-002：Cookie + PostgreSQL 伺服器端 Session

**決策**：32-byte 隨機 session token 放 HttpOnly Cookie；資料庫保存 SHA-256 hash、獨立 CSRF token、到期時間。每次請求讀回目前 User 狀態與角色。

**替代方案**：localStorage JWT、Redis Session。JWT 的撤銷與權限變更即時性更複雜，也增加瀏覽器可讀 bearer token 的風險；Redis 對此規模增加不必要的基礎設施。

**取捨**：每次請求有一次 Session 查詢，接受這個成本換取明確登出、到期與停用語義。

## ADR-003：Serializable + 固定 row lock 順序 + 部分唯一索引

**決策**：業務寫入用 Serializable 交易；借還鎖定 Employee → Asset；有效領用由 PostgreSQL 部分唯一索引限制。交接與新增領用共用 Employee lock。

**替代方案**：只在前端禁用、先查後改、分散式 mutex、僅使用樂觀版本欄位。前兩者無法防並行競態；分散式鎖多一個失敗來源；純版本欄位仍需協調 Employee 與 Asset。

**取捨**：高競爭時可能需要 retry，超過上限回 409。這比接受不一致更合理。測試實際找到 Prisma 7 adapter 的 COMMIT 原生 SQLSTATE、P2010 包裝與 P2034 不同錯誤路徑，重試 helper 都有處理。

## ADR-004：Prisma 7.10.1 + Pg adapter

**決策**：使用經 npm audit 確認無已知漏洞的固定版本與純 JS PostgreSQL adapter。

**替代方案**：原候選 Prisma 6.19.3 與傳統 binary engine；原候選 Vitest 3、較舊 Fastify static。實際安裝後 audit 發現已公告的轉依賴與測試工具漏洞，因此在產生正式 Migration 前改採已修補的相容版本，並完整重跑測試。沒有使用 rc 版本。

**取捨**：Prisma 7 的 datasource URL 位於 `prisma.config.ts`，runtime 以 `PrismaPg` 明確提供連線；文件與 Docker 都依此設定。固定 pg 8，整合測試壓力情境會出現 pg client query queue 的 upstream deprecation warning，測試仍實際通過；升到 pg 9 前需重新檢查 adapter 行為。

## ADR-005：不可刪除的業務歷史與 append-only audit

**決策**：一般 UI／API 不提供硬刪除。狀態轉移保留領還、維修、交接與 actor FK。核心寫入與 audit 同一交易；DB trigger 阻擋 audit UPDATE／DELETE。

**替代方案**：刪除後另存 JSON、只靠應用程式不提供刪除按鈕、外部事件匯流排。前兩者較易破壞追溯，後者超出單體需求。

**取捨**：不是防 owner 竄改的 WORM 儲存；正式環境最小 DB 權限、備份與外部監控仍屬營運責任。

## ADR-006：原生 Dialog、少量共用元件與頁面本地狀態

**決策**：原生 `<dialog>` 處理焦點與鍵盤；共用 FormDialog、SearchSelect、AsyncState、Pagination；Pinia 只管理登入狀態。

**替代方案**：大型 UI framework、所有伺服器結果都放全域 store、手寫 focus trap。對 11 頁的系統額外成本較大；不需要雙份資料快取同步，也不重造瀏覽器已有能力。

**取捨**：需現代瀏覽器；已在 Chromium 桌面與 Pixel 7 模擬環境驗證，未宣稱完成實體 iOS Safari 測試。日期選擇器採原生控制。

## ADR-007：明確的隔離展示與生產環境邊界

**決策**：Seed 要求明確 opt-in，production 一律拒絕；Compose 綁 localhost，使用 development HTTP 展示。production 要求 HTTPS APP_ORIGIN 與 Secure `__Host-` Cookie。

**替代方案**：所有環境預設 demo 帳密、在作品集直接公開帶帳密站點。違反安全與授權範圍。

**取捨**：沒有購買服務、公開網站、SSO、SMTP 或密碼重設流程。GitHub 是 Private，僅推送程式碼與合成資料設定。

## ADR-008：格式與品質責任分開

**決策**：ESLint 負責 TypeScript／Vue 品質規則，Prettier 固定格式；使用官方 `eslint-config-prettier` 關閉重複格式檢查。

**取捨**：`no-undef` 在 Vue TypeScript 檔停用，交由 vue-tsc strict 完整檢查型別／名稱。未關閉業務、安全或測試斷言；Lint 必須零警告。

## ADR-009：業務曆日與事件時間分開

**決策**：共用套件集中 Asia/Taipei 的「今天」，DATE 使用純日期 API 契約與 UTC 午夜 carrier；Timestamp 保留 UTC 儲存與傳輸，連線 session 固定 UTC，前端明確用業務時區顯示。

**理由**：UTC 今天在台灣 00:00–07:59 是前一天；使用瀏覽器預設時區也會讓同一筆事件顯示不同曆日。DATE 本身沒有時區，不能將它視為本地午夜或一般 Timestamp。

**影響**：同步更新所有 Vue 日期輸入與 API DATE response。既有 TIMESTAMP(3) 與 Migration 不改，避免重新解讀歷史瞬間；直接寫入資料庫須遵守 UTC session 契約。

## ADR-010：離職結案明確確認實際離職日

**決策**：完成既有交接時必填 leftAt，驗證到職日 ≤ 實際離職日 ≤ 業務今天；plannedLeaveAt 保留規劃值，completedAt 保存當下時間。全部設備歸還、實際離職確認與員工 INACTIVE 仍在同一交易提交。

**理由**：既有三個欄位已能表達不同概念，無需增加重複欄位、Migration 或獨立 HR 模組。可補登已發生的離職，但不能把未來計畫當成已離職。提前收齊設備則留在 OFFBOARDING 等實際離職確認。

**影響**：交接結案 API 新增必要 body，沿用原 Dialog 增加必要日期欄位，保留領還與維修流程。舊版可能誤填的 leftAt 需外部人事事實才能更正，此次保留歷史，不自動回填。
