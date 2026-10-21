# AssetFlow 第一輪工程審查修正

## 修正前後

| 問題            | 修正前                                               | 修正後                                                               |
| --------------- | ---------------------------------------------------- | -------------------------------------------------------------------- |
| 今天與逾期      | 以 UTC 日期判斷，台灣午夜後可能仍算前一天            | 共用 Asia/Taipei 業務日期；到期日等於今天不逾期，已歸還不計          |
| DATE API 與輸入 | DATE 以午夜 ISO Timestamp 回傳，顯示受瀏覽器時區影響 | 六種 DATE 欄位以 YYYY-MM-DD 傳輸；前端保留曆日，與 Timestamp 區分    |
| 事件時間        | 顯示依瀏覽器；DB session timezone 未明定             | UTC ISO 傳輸，台灣時區顯示；連線固定 UTC，沿用既有 UTC TIMESTAMP(3)  |
| 離職結案        | plannedLeaveAt 直接寫入 Employee.leftAt              | 必填實際離職日 leftAt；plannedLeaveAt、leftAt、completedAt 各自保存  |
| 結案規則        | 設備歸還即能將未來預計離職員工標記已離職             | 設備歸還且確認實際離職日介於到職與業務今天之間，交易內一起結案／停用 |
| 到職資料編輯    | 可改到晚於尚未結案的預計離職日                       | 鎖內檢查並拒絕造成日期矛盾的編輯                                     |

## 設計與範圍

保留 Vue／Fastify／Prisma／PostgreSQL、既有頁面與元件。只在原完成交接 Dialog 加上必要的實際離職日期欄位，並調整日期與狀態說明。未增加獨立 HR 流程、時區選單或排程。

既有三個欄位已足夠表達不同日期，schema 和三份歷史 Migration 均未變更，無需新 Migration。既有資料庫未 reset、原有資料與不可修改的 Audit Log 均保留。測試按原規範只清理 *_test 庫 fixture，E2E 保留有明確標記的合成歷史；未部署正式環境。

員工 ACTIVE 可領用；OFFBOARDING 禁止新增領用，代表離職交接處理中；設備收齊但尚未確認實際離職時維持 OFFBOARDING。實際離職確認與設備交接完成後才為 INACTIVE。可補登較早的實際離職日，不以預計日期自動停用。

領用、歸還、故障送修、修復／除役、原有 row lock 順序、Serializable 交易與稽核維持原流程。另補並行結案及 audit 失敗 rollback 的回歸證據。

## 相容性與歷史資料

- DATE response 由午夜 ISO 改成純日期；Repository Vue 已同步，其他外部 client 需調整。
- POST /api/offboardings/:id/complete 新增必要 body：`{"leftAt":"YYYY-MM-DD"}`。不提供預計日 fallback。
- 歷史 Audit JSON snapshot 原樣保留；其內原有日期字串不做回寫。
- 舊版 leftAt 可能曾來自 plannedLeaveAt，無法憑程式推定真正的人事日期。本輪不猜測回填，若需校正須依原始人事事實個別核對。
- 既有 PostgreSQL TIMESTAMP(3) 沿用 UTC wall-clock 契約，應用連線固定 UTC；外部 SQL／ETL 亦須遵守 UTC session。

## 驗證結果

- Lint、Type-check、format:check、git diff --check 全部通過。
- Unit 26／26；原13項全部保留。本機預設及 America/Los_Angeles 主機時區皆通過。
- API Integration 43／43；原27項全部保留。本機預設及 America/Los_Angeles 主機時區皆通過。
- E2E：開發伺服器6／6、編譯伺服器6／6；每組保留完整既有流程並加入午夜案例，桌面使用美西、手機使用日本瀏覽器時區。
- Build：shared、API、Vue 全部成功；安全稽核0 vulnerabilities。
- dev／test Migration 狀態均無 pending，既有3份原樣保留。
- GitHub Actions 的當輪 SHA、quality／docker 結果與連結見交付回報；不引用舊 commit 的成功作為本輪證據。

執行紀錄、測試設定問題的修正與重現方式見 [TESTING.md](../TESTING.md)。原有 pg client query queue deprecation warning 保留，未為通過測試而隱藏。

## 實際修改檔案

- `.github/workflows/ci.yml`
- `API.md`
- `ARCHITECTURE.md`
- `BUSINESS_RULES.md`
- `DATABASE_DESIGN.md`
- `DECISIONS.md`
- `README.md`
- `TESTING.md`
- `apps/api/prisma/seed.ts`
- `apps/api/src/app.ts`
- `apps/api/src/dates.ts`
- `apps/api/src/db.ts`
- `apps/api/src/repositories/catalog.ts`
- `apps/api/src/routes.ts`
- `apps/api/src/schemas.ts`
- `apps/api/src/services/catalog.ts`
- `apps/api/src/services/lifecycle.ts`
- `apps/api/test/integration.test.ts`
- `apps/web/src/composables/forms.ts`
- `apps/web/src/pages/AssetDetail.vue`
- `apps/web/src/pages/Assignments.vue`
- `apps/web/src/pages/EmployeeDetail.vue`
- `apps/web/src/pages/Offboarding.vue`
- `apps/web/src/types.ts`
- `apps/web/test/dates.test.ts`
- `docs/ENGINEERING_REVIEW_1.md`
- `docs/openapi.json`
- `e2e/lifecycle.spec.ts`
- `packages/shared/src/dates.ts`
- `packages/shared/src/index.ts`
- `playwright.config.ts`
