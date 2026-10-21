# 測試與驗收紀錄

日期：2026-10-21（Asia/Taipei）。所有數量以實際執行輸出為依據；合成 Seed 資料不作為測試通過證據。

## 測試架構

| 層次                 | 位置                                  | 實際依賴                                                                                    |
| -------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| 前端單元／元件       | `apps/web/test/ui.test.ts`            | Vitest + Vue Test Utils + jsdom；僅此層對 fetch／Dialog DOM 方法使用 stub                   |
| API／PostgreSQL 整合 | `apps/api/test/integration.test.ts`   | Fastify inject、真實 Argon2id、真實 PostgreSQL、Prisma、Migration；不 mock repository／交易 |
| 桌面／手機 E2E       | `e2e/lifecycle.spec.ts`               | Chromium Desktop Chrome + Pixel 7、真實前端、API、示範 PostgreSQL                           |
| 封裝煙霧測試         | `.github/workflows/ci.yml` docker job | Linux Docker build + Compose PostgreSQL + Migration + Seed + HTTP                           |

API 測試使用 TEST_DATABASE_URL，設定與 cleanup 都要求 DB 名稱以 `_test` 結尾。每個案例重建專用測試表格資料，整套結束後清空測試 fixture。沒有清空開發展示庫。E2E 會保留明確標記的合成資產、員工與生命週期歷史，以便檢查。

## 第一輪工程審查修正（2026-10-21）

本輪保留全部原有測試，既有交接測試僅補上必要的明確實際離職日。新增檔案 `apps/web/test/dates.test.ts`，並擴充原 API／E2E 測試。

| 項目                                         | 本輪結果                                                                                |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Lint／Type-check／format:check／diff --check | 通過，零 Lint 警告                                                                      |
| Unit／Vue components                         | 26 項通過（原13項全部保留）；本機預設與 America/Los_Angeles 皆通過                      |
| API Integration／真實 PostgreSQL             | 43 項通過（原27項全部保留）；本機預設與 America/Los_Angeles 皆通過                      |
| Build                                        | shared／API／Vue 全部成功                                                               |
| Migration                                    | dev／test 均確認既有3份已套用，沒有 pending；本輪未改 schema／Migration                 |
| npm audit --audit-level=moderate             | 0 vulnerabilities                                                                       |
| 瀏覽器矩陣                                   | dev 與 compiled 各6項；Desktop Chrome 使用 America/Los_Angeles、Pixel 7 使用 Asia/Tokyo |
| GitHub Actions                               | 本輪 commit 的 quality／docker 結果以交付連結與對應 SHA 為準；下方舊版結果不是本輪證據  |

新增覆蓋：台灣午夜前1毫秒與整點、UTC 換日前後、跨年、閏日、無效 date-only、日期預填、事件時間的台灣顯示、DATE 在 PostgreSQL 非 UTC session 往返、巢狀 API 日期與 Decimal、UTC timestamp 預設值不偏移、今日到期不逾期、已還設備排除、缺漏／未來／早於到職的實際離職日、預計與實際不同、延後補登、編輯到職日防矛盾、並行結案唯一成功、交接稽核失敗整筆 rollback。

執行期間保留並分析過兩種瀏覽器失敗：午夜前1毫秒使用走動時鐘會在開表單前跨日，改用 `page.clock.setFixedTime()` 固定 Date；另一輪 trace 顯示 `/api/*` 回502，原因是本機同步執行 shared build 觸發 tsx dev server 重載。完整 E2E 改依 CI 順序在編譯完成後獨立執行，沒有移除測試、放寬日期斷言或加入 force click。

額外主機時區重現（需先完成 shared build）：

```powershell
$env:TZ = 'America/Los_Angeles'
npm.cmd test
npm.cmd run test:api
Remove-Item Env:TZ
```

E2E 請在 Build／Type-check 完成後執行，避免 watch server 在瀏覽途中因 shared/dist 重建而重啟。既有 pg query queue deprecation warning 保留，未關閉警告。

## 第一版基準結果（保留歷史）

| 項目                               | 結果／範圍                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prisma Client generate             | 成功，7.10.1                                                                                                                                                            |
| PostgreSQL Migration               | 本機 dev／test 3 份成功；CI 乾淨 DB 成功                                                                                                                                |
| Seed idempotency                   | 連續執行 2 次成功；20 名示範員工、50 項資產，不重複新增；之後 E2E 合成紀錄另計                                                                                          |
| `npm run lint`                     | 零錯誤／零警告                                                                                                                                                          |
| `npm run typecheck`                | TypeScript strict、vue-tsc 成功                                                                                                                                         |
| `npm test`                         | 13 項通過                                                                                                                                                               |
| `npm run test:api`                 | 27 項通過（包含 nullable 結案約束與限流回歸測試）                                                                                                                       |
| `npm run test:e2e`                 | 4 項通過：2 個主要流程 × desktop/mobile                                                                                                                                 |
| `npm run build`                    | shared、API、Vue production bundle 成功；主要 JS gzip 約42 KiB，頁面採 lazy chunks                                                                                      |
| `npm audit --audit-level=moderate` | 當次結果 0 vulnerabilities                                                                                                                                              |
| OpenAPI                            | 從實際 route schemas 匯出；主要 request／狀態碼整合測試通過                                                                                                             |
| 本機瀏覽器截圖                     | 真實登入後從 API 載入 Dashboard／Assets／Offboarding；另含 Login、mobile Dashboard                                                                                      |
| GitHub Actions                     | 第一輪 [39587665457](https://github.com/Cizing24/assetflow-itam/actions/runs/39587665457) quality 與 docker 都 success；對應 `e3849da9497d96dd926c60655729a51af0896fac` |
| Docker                             | **本機未安裝**；在上述 GitHub Actions Ubuntu runner 實際 build、up、seed、health、首頁 HTTP 成功                                                                        |

第一輪 CI 的 API 案例數為25；後續加入 DB nullable 結案約束與 API 限流回歸案例，目前27項。dev 與 compiled server 的 E2E 各4項均已在本機通過，共8次瀏覽器驗證。最後一輪交付 CI 與 commit 請以 GitHub Actions 及交付回報為準，勿把舊 commit 的 CI 視為任意後續修改的驗證。

## API 測試案例

1. 未登入無法讀取全部受保護業務資源。
2. 錯誤密碼及不存在帳號均回一致401。
3. Cookie HttpOnly／SameSite；DB 無 raw session token。
4. Viewer API 寫入403；IT 不可管理帳號。
5. 無 CSRF／錯誤 Origin 拒絕，包括 login Origin。
6. Logout／到期後無法重用 Session。
7. 角色變更撤銷 Session，最後管理員不能降級。
8. 資產及員工建立／資產更新與稽核；拒絕直接 status 寫入。
9. 資產編號／有值序號正規化唯一，多筆空序號允許。
10. 無效日期、FK、pageSize 上限400。
11. 搜尋、狀態＋分類、排序與分頁。
12. 除役後保留紀錄、不能領用，沒有 DELETE 端點。
13. Checkout、重複領用、正常歸還、重複歸還的狀態與歷史。
14. **8 個並行 Checkout（不同員工、同一資產）：恰一筆201、七筆409，一筆有效領用、一筆 CHECKOUT audit。**
15. 直接 DB 寫入第二筆有效領用仍受 partial unique index 阻擋。
16. **以測試 trigger 讓 CHECKOUT audit 寫入失敗：回500，資產 AVAILABLE、無 assignment、無 audit。**
17. 並行 Checkin 恰一筆200、一筆409。
18. 維修中不可領用，進度更新、AVAILABLE 結案、重複結案409。
19. 故障歸還描述必填、自動送修、RETIRED 結案。
20. 持有三項設備時交接409，逐項歸還後結案；歷史保留，員工 INACTIVE 不能領用。
21. 同時啟動交接／領用的鎖定與重新驗證。
22. 同時歸還／完成交接的安全重試。
23. DB trigger 拒絕 audit UPDATE／DELETE。
24. Dashboard 真實統計，登出再登入仍從 DB 讀回狀態。
25. OpenAPI 主要路由存在，User response 無 passwordHash。
26. DB 拒絕只有完成日期卻缺少歸還狀況／維修結果的半完成紀錄。
27. 305 個靜態請求不消耗 API 配額；300 個 API 仍正常，第301個回統一429，健康檢查仍200。

## E2E 流程

每項都在 desktop 與 mobile 執行，不使用假 API。

- 未登入進入 assets → 登入頁；Viewer 登入 → 可讀資產、無新增按鈕 → refresh 仍讀 DB → users 路由被擋 → 登出。
- Admin 登入 → 建立員工 → 建立資產 → 領用給新員工 → refresh 保留領用 → 啟動交接 → 有設備時無法完成 → 故障歸還，先驗證缺描述錯誤 → 填描述並送修 → 清單重新計算 → 完成交接 → 更新維修進度 → 完成修復 → 資產恢復 AVAILABLE → Audit 查到結案。

手機案例額外以 `page.viewportSize().width` 比較 document scrollWidth，防止 layout viewport 本身被撐寬時錯誤通過。沒有使用 force click、跳過斷言或移除 mobile 專案。

## 實際失敗與修正

- Prisma binary 下載與本機 TCP 初受 sandbox 網路限制：以核准權限下載官方套件、連線隔離 loopback DB。
- workspace dev CWD 不在 root：環境設定改為相對 source／dist 檔位置解析 repository `.env`。
- Fastify 重複設定 404 handler：收斂為同一 handler，僅在靜態 decorator 存在時對非 API 做 SPA fallback。
- Prisma 7 COMMIT／raw query 的衝突錯誤型態不同：處理 P2034、adapter cause、P2010 meta 中的40001／40P01，再跑整套並行測試。
- advisory lock 的 PostgreSQL void 回傳不能用 queryRaw 反序列化：改用 executeRaw。
- SQL CHECK 對 NULL／UNKNOWN 的語義：新增第三份 Migration 明確要求完成欄位非NULL，補真實 DB 回歸案例。
- OpenAPI query schema 與 HTTP string 型別：query page/pageSize 先驗證數字字串，再由 Zod 強制轉型並檢查界限。
- 原生 Dialog 必填星號不是 label locator 的完整文字：E2E 使用語意角色；星號對 assistive technology 隱藏，HTML required 保留。
- **手機點擊錯位**：表頭 sr-only 絕對定位元素缺少就近 containing block，把 layout viewport 412px 撐至793px。`th position:relative` 修正根因，另補 Dialog fixed／margin auto 與背景捲動控制，完整 mobile E2E 通過。
- Prettier 與 Vue 格式規則衝突：使用 eslint-config-prettier，保留程式品質規則與 strict 型別檢查。
- 正式 bundle 的 SPA 刷新：Vite 預設 `/assets/` 與資產詳情業務路由衝突。改用 `/_static/` 儲存編譯資源，未知 API／靜態檔仍維持 JSON 404；另加 compiled server 的桌面／手機全流程 E2E。
- 正式 bundle 高密度瀏覽器操作：靜態 chunk 原先消耗全域 API 限流配額，造成 lazy import 回429。限流明確限縮到 `/api/`，保留每分鐘300次及登入10次；靜態資源與健康檢查不消耗配額。
- 初次未登入也會收到 Session 查詢401，不能一律顯示「登入已到期」。只有 client 先前持有 Session token 時才發出到期事件；新增元件回歸測試與 E2E 登入頁斷言。

## 重現指令

見 README 測試段落。API：`npm run test:api`；元件：`npm test`；E2E：`npx playwright install chromium` 後 `npm run test:e2e`。若伺服器已開著，Playwright 在本機會重用它；CI 一定新開。

失敗時保留 `test-results` 的 screenshot／trace；可用 `npx playwright show-trace <trace.zip>`。GitHub Actions 上傳測試證據保留7日。截圖重建使用 `npm run docs:screenshots`，需啟動並 Seed 隔離展示環境。

正式 bundle 的額外 E2E（先完成 `npm run build`，3002 port 保持未使用；測試自行啟停伺服器）：

```powershell
$env:E2E_BASE_URL = 'http://localhost:3002'
$env:E2E_SERVER_COMMAND = 'npm start'
$env:APP_ORIGIN = 'http://localhost:3002'
$env:PORT = '3002'
npm.cmd run test:e2e
```

以上環境變數只應用於該終端；回開發模式時移除，或使用新終端。CI 分別執行 dev 與 compiled 兩組，每組各4項。

## 未驗證與限制

- 未在本機 Docker Desktop 執行；Docker 的實際通過證據來自 Linux CI。
- 未在實體手機、iOS Safari、Firefox／WebKit 驗證；Pixel 7 是 Chromium 模擬。
- 未做長時間 soak、數萬資產容量、正式網路／備份還原、完整 WCAG AA 稽核或第三方滲透測試。
- pg 8.23.1 在並行失敗／rollback 壓力測試會顯示 query queue deprecation warning；未隱藏警告，所有狀態與交易斷言仍實際通過。升級 pg 9 前需重新驗證 Prisma adapter。
- Seed 的冪等性採 preserve-existing；不是重設任意使用者改動的重置工具。
