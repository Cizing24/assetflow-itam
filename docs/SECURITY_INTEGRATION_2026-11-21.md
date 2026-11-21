# 依賴安全修復與展示整合

日期：2026-11-21（Asia/Taipei）。本輪修復前輪 CI 的依賴安全阻礙，保留既有展示素材、功能、資料庫結構與安全 gate，不新增部署服務。

## 修復前的證據

重新對原 lockfile 執行 `npm audit --json`，結果仍為 15 項：12 moderate、3 high。這是受影響套件數，同一個弱點可能同時列在其上游相依套件，並非 15 個獨立攻擊方法。原 [展示 PR CI](https://github.com/Cizing24/assetflow-itam/actions/runs/44796233851) 的功能與 Docker 檢查成功，最後由 audit 擋下。

| 相依路徑                                                         | 問題與官方修補來源                                                                                                           |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `prisma → @prisma/config → effect`                               | [TemplateLiteral ReDoS](https://github.com/Effect-TS/effect/security/advisories/GHSA-7589-6fvf-x4pw)，官方修補為 3.22.1      |
| `@fastify/static → glob`、`@vue/test-utils → js-beautify → glob` | [取消後仍繼續遍歷檔案](https://github.com/isaacs/node-glob/security/advisories/GHSA-3g3m-2fjr-6pw4)，修補為 14.0.2 以上      |
| `typescript-eslint`、`glob`、`editorconfig` 的 `minimatch`       | [Pattern amplification DoS](https://github.com/isaacs/minimatch/security/advisories/GHSA-g3hv-75wg-m249)，修補為 11.0.1 以上 |

HTTP 輸入驗證仍使用 Zod；effect 位於 Prisma 設定工具鏈，沒有用來解碼公開 API payload。靜態資源也沒有提供任意 glob 搜尋端點。這些條件影響可利用範圍，但不作為忽略弱點的理由。

## 最小修補

| 項目                         | 修復前 | 修復後  | 選擇與取捨                                                                                                                                            |
| ---------------------------- | ------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@fastify/static`            | 10.1.6 | 10.1.12 | 同 major patch；採用上游支援 glob 14 的版本，並包含 [dot-directory listing 安全修補](https://github.com/fastify/fastify-static/releases/tag/v10.1.12) |
| `typescript-eslint`          | 8.72.0 | 8.73.0  | 同 major minor；沿用現有 lint 規則，不開啟新增規則                                                                                                    |
| `@prisma/config → effect`    | 3.20.0 | 3.22.1  | 只在此父套件下 override，保留 Prisma／Client／adapter 7.10.1                                                                                          |
| `js-beautify → glob`         | 13.0.6 | 14.0.6  | 只在 formatter 下 override，驗證既有 `globSync` API                                                                                                   |
| `js-beautify → editorconfig` | 3.0.2  | 4.0.1   | 只在 formatter 下 override；4.x 支援 Node >=22，與專案 Node 22 LTS 範圍一致，並帶入安全的 minimatch 11                                                |

Vue、Fastify、Prisma、資料庫 schema、Migration、認證、角色及交易程式未變更。沒有使用 `npm audit fix --force`、ignore、降低 severity 或跳過測試。Lockfile 由 npm 產生，沒有手改 integrity 或移除弱點紀錄來製造通過。

`glob` 與 `editorconfig` 的轉依賴跨 major，因此不能只以 audit 歸零當作相容證明。新增的小型測試實際執行 formatter 的 glob、EditorConfig brace pattern 與 Vue wrapper HTML 格式化；既有 build、API、E2E 與 Docker 再檢查產品流程。上游 js-beautify／Prisma 接受安全依賴後，應移除對應 override，重新安裝並跑相同檢查。

## 驗證

修補後 lockfile 與乾淨安裝的 audit 都為 0（所有 severity 都為 0），保留原本 moderate gate。下表為本輪實際本機執行結果；遠端 CI 與合併 commit 以對應 PR timeline 為準。

| 驗證                                          | 本輪結果                                                                   |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `npm ci` / `npm audit --audit-level=moderate` | 乾淨安裝成功，0 vulnerabilities                                            |
| `npm test`                                    | 27 項通過，原 26 項保留，新增 1 項轉依賴相容測試                           |
| `npm run test:api`                            | 43 項真實 PostgreSQL 整合通過，包含權限、CSRF、並行、回滾與日期            |
| `npm run test:e2e`                            | compiled 桌面／Pixel 7 Chromium 模擬 6 項通過，34.4 秒                     |
| Prisma generate / Migration                   | Client 7.10.1 產生成功；隔離 demo 與 test 庫的 3 份 Migration 均無 pending |
| lint / typecheck / build / format             | 全部成功，沒有關閉規則                                                     |

所有資料庫檢查使用本任務既有的隔離叢集，沒有操作原本開發或正式資料。pg query queue 與終端色彩的既有 warning 保留，沒有為了通過檢查隱藏警告。相容測試初稿的 Windows 路徑預期改用 `path.join`；另改以 block 元素觸發 HTML pretty print，避免將本來就維持同列的 inline 元素當作格式化失敗。既有測試與產品程式未放寬。

Lockfile 差異包含 npm 重新序列化既有 Tailwind 4.3.3 的 optional／inBundle metadata；Tailwind 版本沒有變動。新增與變更的套件來源仍為官方 npm registry。

## 整合方式

獨立安全分支 `fix/dependency-security` 以展示分支為基準。安全 PR 通過後依正常流程合併至展示分支，再讓 [展示 PR #3](https://github.com/Cizing24/assetflow-itam/pull/3) 進入 [README PR #1](https://github.com/Cizing24/assetflow-itam/pull/1) 的分支；PR #1 重新通過後才進入 main。保留 Git 歷史，不 force push、不使用 admin bypass、不合併部署準備 PR #2。

沒有新增公開 Demo 或觸發人工正式部署。實體手機、Safari／Firefox、長時間負載、完整無障礙與第三方滲透測試仍未在本輪執行；audit 0 也不代表沒有未知弱點。
