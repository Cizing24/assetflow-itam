# AssetFlow 展示素材與驗證

日期：2026-11-21（Asia/Taipei）。本次只更新 README、架構與展示文件、媒體，沒有變更產品功能、套件版本或部署設定。

## 基準與保留範圍

- 程式基準為 `main` 的 `7a698fbcd8bbffb4e46ec434a310690973aab77a`，對應 [成功的 CI](https://github.com/Cizing24/assetflow-itam/actions/runs/39593727102)。
- 文件分支從既有 [README PR #1](https://github.com/Cizing24/assetflow-itam/pull/1) 的 `7ddd547` 建立；新 PR 以 `docs/readme-portfolio-overview` 為 base，避免覆蓋尚未合併的 README 成果。沒有合併任何 PR。
- [部署準備 PR #2](https://github.com/Cizing24/assetflow-itam/pull/2) 仍獨立保留，未納入或部署。本次查核 Repository 為 Public；服務仍僅在本機執行。
- 原工作目錄的未追蹤設定與既有開發成果保持原樣；本次使用獨立 worktree。

## 素材

| 素材                               | 來源與用途                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `media/cover.png`                  | 本次重新擷取 1440 × 810 真實 Dashboard，16:9；前段直接顯示產品畫面                     |
| `media/asset-form.png`             | 本次真實新增資產表單，說明 Vue 共用表單與資料驗證                                      |
| `screenshots/assets.png`           | 重用既有真實資產清冊畫面                                                               |
| `screenshots/offboarding.png`      | 重用既有真實離職交接畫面                                                               |
| `screenshots/dashboard-mobile.png` | 保留既有手機版畫面入口，沒有重複存檔                                                   |
| `media/demo.gif`                   | 本次連續錄製的設備領用與正常歸還，從完整影片擷取；18.63 秒、960 × 540、2,501,053 bytes |
| `media/demo.mp4`                   | 真實 Chromium 操作；74.92 秒、1440 × 810、747,266 bytes，H.264／yuv420p、faststart     |

錄影前以獨立瀏覽器 context 登入，再將 Session 帶入錄影 context；密碼輸入與 Cookie 沒有納入畫面。影片中的員工、設備與日期均來自隔離 Seed 或明確標記為 `SHOWCASE-` 的新展示紀錄，沒有正式業務資料。沒有外部影音託管；MP4 由 Repository 直接提供下載播放。

影片流程：工作總覽 → 資產列表 → 新增資產 → 搜尋 → 編輯存放位置 → 領用 → 歸還 → 離職交接 → 維修工作台 → 操作紀錄。領還成功與頁面回饋由 Playwright 斷言確認，未使用攔截 API、假成功畫面或靜態圖片拼接。

## 架構核對

先使用 graphify 做程式結構抽取，再回讀 HTTP 邊界、狀態轉移與 SQL 約束。56 個 tracked code 檔產出 293 個節點、948 條關係；3 份 SQL Migration 因選用 SQL parser 未安裝而人工核對，Prisma schema 亦直接核對。節點數不代表測試覆蓋率。

| 核對項目                                   | 實作來源                                                         |
| ------------------------------------------ | ---------------------------------------------------------------- |
| Vue 頁面與路由、登入守衛                   | `apps/web/src/router.ts`、`stores/auth.ts`                       |
| 可取消請求、篩選、分頁                     | `apps/web/src/composables/data.ts`、`api/client.ts`              |
| 共用原生 Dialog 與表單                     | `apps/web/src/components/FormDialog.vue`、`composables/forms.ts` |
| Session、Origin、CSRF 與角色               | `apps/api/src/auth.ts`、`routes.ts`                              |
| Serializable、重試與 Employee → Asset 列鎖 | `apps/api/src/db.ts`、`services/lifecycle.ts`                    |
| 有效領用唯一、稽核保護與完成條件           | `apps/api/prisma/migrations/`、`schema.prisma`                   |

README 的 Mermaid 與 [架構文件](../ARCHITECTURE.md) 都只描述實際存在的元件；沒有 Redis、訊息佇列、外部身分服務或多租戶層。沿用現有 [ADR](../DECISIONS.md)，未為展示工作新增無必要決策。

## 本次驗證

使用本次新建的獨立 PostgreSQL 18 叢集；展示庫與 `_test` 測試庫分開，沒有連接原本開發庫或正式環境。

| 檢查                               | 本次結果                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `npm ci`                           | 完成，依原 lockfile 安裝，沒有修改版本                                     |
| Prisma generate、Migration 與 Seed | 成功；3 份 Migration，合成資料 3 個帳號、20 名員工、50 項初始資產          |
| `npm test`                         | 26 項通過                                                                  |
| `npm run test:api`                 | 43 項通過，真實 PostgreSQL；保留 pg query queue 的既有 deprecation warning |
| `npm run test:e2e`                 | compiled 模式 6 項通過（桌面／Pixel 7 Chromium 模擬），33.3 秒             |
| `npm run lint`                     | 通過，零警告                                                               |
| `npm run build`                    | shared／API／Vue 全部成功                                                  |
| `npm audit`                        | 15 項弱點：12 moderate、3 high；需後續處理，未以歷史 0 弱點取代本次結果    |

第一次 API 測試因錄影將 `APP_ORIGIN` 設為自訂埠、而既有測試 fixture 固定 `http://localhost:5173`，全部被 Origin 防護拒絕。這是展示環境設定差異；重跑時使用 fixture 的 Origin，沒有修改測試斷言或安全防護。

媒體以 FFmpeg 完整解碼驗證；README 本機連結、PNG 尺寸、GIF 多影格與時長、MP4 時長及 Mermaid parse／render 都另行檢查。錄影腳本成功完成全流程，沒有瀏覽器 `pageerror`。GitHub PR 的最終 CI 結果以該 PR 對應 commit 為準，本機測試不代替遠端結果。

## 已完成與限制

資產、員工、領還、維修、交接、角色與稽核均為已實作功能，並使用真實 PostgreSQL。Seed 內容是合成資料，不代表任何企業的營運成果。沒有多租戶、SSO、SMTP、忘記密碼、檔案上傳或 QR Code。

未驗證實體手機、Safari／Firefox、長時間壓力、完整無障礙及第三方滲透測試。本次沒有部署公開服務、合併 PR 或升級弱點套件。

中文潤飾保留命令、日期、數字、連結、風險與既有真實協作聲明；將抽象宣傳改成具體操作和可回查的測試，沒有增添個人經歷或商業成效。
