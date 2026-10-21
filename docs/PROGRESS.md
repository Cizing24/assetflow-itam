# 開發與驗收紀錄

2026-10-21 開始：原工作目錄為空，不是 Git repository。新專案位於獨立 assetflow-itam 子目錄。

本機 Node 22.23.1；PostgreSQL 18 安裝於 Program Files，使用專案內獨立資料目錄與 55432 port。Docker / gh 未在 PATH。

## 階段狀態

| Phase                        | 實作與真實驗證                                                                                                                                                                        | Git 里程碑                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 1 Foundation                 | npm workspaces、strict TS、Vue／Fastify 可啟動，真實 PostgreSQL 18.4、3份 Migration、Seed 重跑2次、Compose 與 CI                                                                      | `6efaff2` foundation；後續修正在同一線性歷史             |
| 2 Authentication & Core Data | Session／Origin／CSRF／RBAC、資產與員工 API/UI；型別、Build、API 與瀏覽器驗證                                                                                                         | `738b214` API；`e57a920` web                             |
| 3 Business Workflows         | 領還、維修、除役、交接、Audit、鎖與唯一約束；真實並行與故障注入 rollback 測試                                                                                                         | `738b214` 業務 service；`e3849da` 測試與修正             |
| 4 Dashboard & UX             | DB 快照 Dashboard、完整11頁、RWD與狀態回饋；修正手機 sr-only／Dialog 競合問題；桌面／手機4項E2E通過                                                                                   | `e57a920` UI；`e3849da` 完整瀏覽器驗證                   |
| 5 Quality & Delivery         | 12元件測試、27 DB整合測試、dev／compiled各4項 E2E、Build、Lint、型別、npm audit；Private GitHub已推送，第一輪 quality／docker jobs success；八份技術文件、OpenAPI與五張展示截圖已完成 | `e3849da` 首輪CI；最後交付以 Repository 最新 commit 為準 |

部分模組在驗收前交錯實作，Git 依 foundation／API／UI／quality 保留實際里程碑，沒有杜撰每個 commit 都含完整產品。首輪可驗證 CI：[39587665457](https://github.com/Cizing24/assetflow-itam/actions/runs/39587665457)。

## 邊界

沒有公開部署、付費雲端資源或修改其他專案。Docker 未在本機安裝，已由 GitHub Actions 的 Linux runner 實際驗證。其餘覆蓋限制與 upstream pg warning 見 TESTING.md。

不以 Seed 或文件存在代表測試通過；最後交付前仍需讀回最新 commit 與 CI 結果。
