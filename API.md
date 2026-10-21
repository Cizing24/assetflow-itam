# REST API

開發透過 `http://localhost:5173/api` 同源代理；編譯展示由 Fastify 同源提供。`GET /health` 檢查 PostgreSQL；`GET /openapi.json` 是由實際 route schemas 產生的 OpenAPI。Repository snapshot 在 `docs/openapi.json`，以 `npm run docs:api` 更新。

OpenAPI 定義寫入欄位、列表 query、成功狀態、錯誤 envelope 與 Session/CSRF security。成功 response 目前保留一般 JSON object schema，完整資源欄位以本文、Prisma schema 與 web types 為準，未宣稱全量 response schema codegen。

## 日期契約（第一輪修正）

業務時區固定 Asia/Taipei。`purchasedAt`、`warrantyUntil`、`joinedAt`、`leftAt`、`expectedReturnAt`、`plannedLeaveAt` 的 request／response 均為 `YYYY-MM-DD`（可為 null 的欄位保留 null），包括巢狀 employee／asset／assignment／offboarding。其餘時間欄位為 UTC ISO timestamp，例如 `2030-10-20T16:30:00.000Z`；前端顯示為台灣當地時間。

相容性變更：舊版 DATE response 曾輸出午夜 `...T00:00:00.000Z`，現在回傳純日期；交接結案由無 body 改為必填 `{leftAt}`。Repository Vue 已同步，外部 API client 須同步調整。歷史 Audit JSON snapshot 原樣保留，可能包含舊版序列化的日期。

## 驗證

```http
POST /api/auth/login
Origin: http://localhost:5173
Content-Type: application/json

{"email":"admin@assetflow.local","password":"<your isolated DEMO_PASSWORD>"}
```

成功 200，Set-Cookie 為 HttpOnly Session，JSON：

```json
{
  "user": {
    "id": "<uuid>",
    "email": "admin@assetflow.local",
    "name": "林管理員",
    "role": "ADMIN"
  },
  "csrfToken": "<random token>"
}
```

後續請求帶 Cookie。unsafe methods 還需同樣 Origin 與 `X-CSRF-Token`。Cookie 名稱在本機是 `assetflow_session`，production 是 `__Host-assetflow`。401 需重新登入；CSRF token 可以從 GET `/api/auth/session` 重建。

## 端點總覽

R = 已登入任一角色；W = ADMIN／IT_STAFF；A = ADMIN。

| Method / Path                     | 權限                        | 成功 | 用途                                            |
| --------------------------------- | --------------------------- | ---- | ----------------------------------------------- |
| POST `/auth/login`                | 未登入可用，Origin 必須正確 | 200  | 真實密碼登入                                    |
| GET `/auth/session`               | R                           | 200  | user 與 csrfToken                               |
| POST `/auth/logout`               | R                           | 200  | 撤銷 Session，`{ok:true}`                       |
| GET `/lookups`                    | R                           | 200  | categories、departments                         |
| GET `/assets`                     | R                           | 200  | 分頁資產；目前有效 assignments 包含 employee    |
| GET `/assets/:id`                 | R                           | 200  | 完整基本資料、所有 assignments、maintenance     |
| POST `/assets`                    | W                           | 201  | 新增 AVAILABLE 資產                             |
| PUT `/assets/:id`                 | W                           | 200  | 完整基本資料更新，不接受 status                 |
| POST `/assets/:id/retire`         | W                           | 200  | `{reason}`，AVAILABLE → RETIRED                 |
| GET `/employees`                  | R                           | 200  | 分頁員工、department 與持有設備數               |
| GET `/employees/:id`              | R                           | 200  | 員工、領還歷史、交接歷史                        |
| POST `/employees`                 | W                           | 201  | 建立 ACTIVE 員工                                |
| PUT `/employees/:id`              | W                           | 200  | 更新基本資料，不接受 status                     |
| GET `/assignments`                | R                           | 200  | 有效與歷史領用                                  |
| POST `/assignments`               | W                           | 201  | Checkout                                        |
| POST `/assignments/:id/checkin`   | W                           | 200  | Checkin                                         |
| GET `/maintenance`                | R                           | 200  | 分頁維修、設備、操作人                          |
| POST `/maintenance`               | W                           | 201  | 開始維修                                        |
| PATCH `/maintenance/:id`          | W                           | 200  | 更新 progress、notes                            |
| POST `/maintenance/:id/complete`  | W                           | 200  | 結案 outcome、notes                             |
| GET `/offboardings`               | R                           | 200  | 即時未歸還清單、employee、operator、completedBy |
| POST `/offboardings`              | W                           | 201  | 啟動離職交接                                    |
| POST `/offboardings/:id/complete` | W                           | 200  | 必填 `{leftAt}`；交易內重驗證                   |
| GET `/audit-logs`                 | R                           | 200  | 唯讀稽核、actor                                 |
| GET `/dashboard`                  | R                           | 200  | 統計與最近活動                                  |
| GET `/users`                      | A                           | 200  | 分頁帳號，不回傳 passwordHash                   |
| POST `/users`                     | A                           | 201  | email、name、role、password（12–128 字元）      |
| PATCH `/users/:id`                | A                           | 200  | role、active；撤銷全部 Session                  |

上表省略共同 `/api` 前綴。除 `/health`、`/openapi.json` 與登入外，業務端點均受 Session 保護。

## Request 範例

資產（POST／PUT）：

```json
{
  "assetTag": "AF-0100",
  "name": "MacBook Pro 14",
  "categoryId": "<uuid>",
  "brand": "Apple",
  "model": "MacBook Pro 14",
  "serialNumber": "DEMO-100",
  "purchasedAt": "2026-10-21",
  "purchasePrice": 62900,
  "warrantyUntil": "2029-10-21",
  "location": "台北 · 3F"
}
```

`serialNumber`、`purchasePrice`、`warrantyUntil` 選填／可為 null；序號空字串會正規化 null。有值序號與資產編號會 trim、大寫。日期須真實有效，保固不可早於購買日。GET 金額回傳 Decimal 字串，例如 `"62900"`。

員工：

```json
{
  "employeeNumber": "EMP-100",
  "name": "示範員工",
  "departmentId": "<uuid>",
  "title": "工程師",
  "email": "demo@example.test",
  "joinedAt": "2026-10-21"
}
```

領用：

```json
{
  "assetId": "<uuid>",
  "employeeId": "<uuid>",
  "expectedReturnAt": "2027-01-31",
  "notes": "新進員工設備"
}
```

正常歸還：`{"condition":"GOOD","notes":"外觀及功能正常"}`。

故障歸還：`{"condition":"DAMAGED","description":"螢幕無法啟動","notes":"已收回設備"}`。description 必填，原子建立維修。

維修建立：`{"assetId":"<uuid>","description":"鍵盤故障","notes":"待檢測"}`。更新：`{"progress":"等待零件","notes":"已聯絡廠商"}`。結案：`{"outcome":"AVAILABLE","notes":"已驗收"}`，outcome 也可為 RETIRED。

交接：`{"employeeId":"<uuid>","plannedLeaveAt":"2027-01-31","notes":"員工離職交接"}`。

交接結案：`POST /api/offboardings/:id/complete`，body `{"leftAt":"2026-10-21"}`。leftAt 必須是已發生的實際離職日，介於 joinedAt 與 Asia/Taipei 今天；不要求等於 plannedLeaveAt。全部設備已歸還且員工仍為 OFFBOARDING 才能成功。缺漏／無效／未來日期 400；未歸還、重複結案或來源狀態不一致 409。成功保存獨立的 completedAt、completedById，員工轉 INACTIVE；GET 員工／交接可讀取三種日期。

## 分頁、搜尋與篩選

列表回傳：

```json
{ "items": [], "total": 0, "page": 1, "pageSize": 20 }
```

共同 query：page（>=1）、pageSize（1–100，預設20）、search（最多100字元）。HTTP query 都以字串傳送，Zod 在伺服器端轉成數字並檢查範圍。

- Assets：`status=AVAILABLE|ASSIGNED|MAINTENANCE|RETIRED`、categoryId；search 查 name/tag/serial/brand/model；sort=createdAt/name/assetTag，order=asc/desc。
- Employees：status=ACTIVE/OFFBOARDING/INACTIVE、departmentId；search 查姓名、編號、email；sort=createdAt/name/employeeNumber。
- Assignments：active=true/false（省略為全部）；search 查設備名稱／編號／員工姓名；固定最新領用優先。
- Maintenance：active=true/false；search 查設備名稱；固定最新建立優先。
- Offboardings：active=true/false；search 查員工姓名；固定最新啟動優先。
- Audit：targetId、targetType、search（action 代碼或 actor 姓名）；固定最新優先。
- Users：search 查 name/email；固定最新建立優先。

列表採穩定次序 ID tie-break（User 第一版僅按 createdAt），不提供跨請求一致快照；查詢時資料可同時變更。各 endpoint 僅使用與其相關的篩選，其他共同 query 欄位不影響結果。

## Dashboard

```json
{
  "total": 50,
  "counts": { "AVAILABLE": 30, "ASSIGNED": 12, "MAINTENANCE": 5, "RETIRED": 3 },
  "utilization": 26,
  "overdueCount": 0,
  "pendingReturns": [],
  "recentActivity": [],
  "offboardingCount": 1
}
```

以上數字僅為格式示例，非固定前端值。`utilization = round(ASSIGNED / (total - RETIRED) * 100)`，沒有有效設備時為0。pendingReturns 最多8筆、只包含有預計歸還日的未歸還設備，按日期排序；overdueCount 計算預計日早於Asia/Taipei 當日的有效領用。recentActivity 最多8筆。統計以同一 RepeatableRead 快照查詢。

## 錯誤

```json
{
  "error": {
    "code": "BUSINESS_CONFLICT",
    "message": "仍有 1 項設備未歸還，無法完成交接。",
    "requestId": "req-a"
  }
}
```

| HTTP | 常見 code                                                             | 用戶端處理                         |
| ---- | --------------------------------------------------------------------- | ---------------------------------- |
| 400  | VALIDATION_ERROR / INVALID_REQUEST / INVALID_REFERENCE / INVALID_DATE | 修正輸入                           |
| 401  | UNAUTHENTICATED / INVALID_CREDENTIALS                                 | 登入或重新登入                     |
| 403  | FORBIDDEN / ORIGIN_REJECTED / CSRF_REJECTED                           | 檢查角色、Origin 或刷新 Session    |
| 404  | NOT_FOUND                                                             | 確認 ID 或路徑                     |
| 409  | BUSINESS_CONFLICT / DUPLICATE / LAST_ADMIN / CONCURRENT_CHANGE        | 重新查詢狀態後處理，不直接顯示成功 |
| 429  | RATE_LIMITED                                                          | 稍後重試                           |
| 500  | INTERNAL_ERROR                                                        | 用 requestId 協助調查              |

一般建立操作沒有通用 idempotency key；網路在提交後中斷時應先查詢資料，避免重複建立。有效領用、歸還、維修與交接的狀態／唯一性約束仍會阻擋重複成功。
