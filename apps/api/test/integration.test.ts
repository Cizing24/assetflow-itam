import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import argon2 from "argon2";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/db.js";
import { hashToken } from "../src/auth.js";
const origin = "http://localhost:5173";
const password = "Isolated-Test-Password-2026!";
type Login = { cookie: string; csrf: string; id: string };
let app: FastifyInstance, admin: Login, itStaff: Login, viewer: Login;
let departmentId: string,
  categoryId: string,
  employeeId: string,
  assetId: string;
let sequence = 0;
const inputAsset = () => ({
  assetTag: `TEST-${++sequence}`,
  name: "Integration laptop",
  categoryId,
  brand: "Test",
  model: "Pro",
  serialNumber: `SERIAL-${sequence}`,
  purchasedAt: "2025-01-01",
  purchasePrice: 100,
  warrantyUntil: "2028-01-01",
  location: "Test office",
});
function write(
  url: string,
  payload?: unknown,
  session = itStaff,
  method: "POST" | "PUT" | "PATCH" = "POST",
) {
  return app.inject({
    method,
    url,
    headers: { origin, cookie: session.cookie, "x-csrf-token": session.csrf },
    ...(payload !== undefined ? { payload } : {}),
  });
}
async function login(email: string) {
  const r = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin },
    payload: { email, password },
  });
  expect(r.statusCode).toBe(200);
  return {
    cookie: r.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    csrf: r.json().csrfToken as string,
    id: r.json().user.id as string,
  };
}
async function makeAsset() {
  return db.asset.create({
    data: {
      ...inputAsset(),
      purchasedAt: new Date("2025-01-01"),
      warrantyUntil: new Date("2028-01-01"),
    },
  });
}
async function checkout() {
  const response = await write("/api/assignments", { assetId, employeeId });
  expect(response.statusCode).toBe(201);
  return response.json().id as string;
}
beforeAll(async () => {
  app = await buildApp(process.env.DEBUG_API_TEST === "true");
  await app.ready();
});
beforeEach(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Refusing to reset non-test database");
  await db.$executeRawUnsafe(
    'TRUNCATE TABLE "AuditLog", "Session", "AssetAssignment", "MaintenanceRecord", "Offboarding", "Asset", "Employee", "Department", "AssetCategory", "User" CASCADE',
  );
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  for (const role of ["ADMIN", "IT_STAFF", "VIEWER"] as const)
    await db.user.create({
      data: {
        email: `${role.toLowerCase()}@example.test`,
        name: role,
        passwordHash,
        role,
      },
    });
  departmentId = (
    await db.department.create({ data: { name: "Test engineering" } })
  ).id;
  categoryId = (await db.assetCategory.create({ data: { name: "Laptop" } })).id;
  employeeId = (
    await db.employee.create({
      data: {
        name: "Test employee",
        employeeNumber: "E-001",
        email: "employee@example.test",
        departmentId,
        joinedAt: new Date("2024-01-01"),
      },
    })
  ).id;
  assetId = (await makeAsset()).id;
  [admin, itStaff, viewer] = await Promise.all([
    login("admin@example.test"),
    login("it_staff@example.test"),
    login("viewer@example.test"),
  ]);
});
afterAll(async () => {
  await app?.close();
  await db.$disconnect();
});
describe("Session、CSRF 與後端權限", () => {
  it("所有業務資源拒絕未登入讀取", async () => {
    for (const path of [
      "assets",
      "employees",
      "assignments",
      "maintenance",
      "offboardings",
      "audit-logs",
      "dashboard",
      "users",
    ])
      expect((await app.inject(`/api/${path}`)).statusCode).toBe(401);
  });
  it("錯誤密碼回傳一致的 401，不洩漏帳號", async () => {
    for (const email of ["admin@example.test", "missing@example.test"]) {
      const r = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        headers: { origin },
        payload: { email, password: "wrong" },
      });
      expect(r.statusCode).toBe(401);
      expect(r.json().error.code).toBe("INVALID_CREDENTIALS");
    }
  });
  it("Cookie 使用 HttpOnly 和 SameSite；資料庫僅保留 token hash", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      headers: { origin },
      payload: { email: "admin@example.test", password },
    });
    expect(r.headers["set-cookie"]).toContain("HttpOnly");
    expect(r.headers["set-cookie"]).toContain("SameSite=Strict");
    const raw = r.cookies[0]!.value;
    expect(
      await db.session.findUnique({ where: { tokenHash: raw } }),
    ).toBeNull();
    expect(
      await db.session.findUnique({ where: { tokenHash: hashToken(raw) } }),
    ).not.toBeNull();
  });
  it("VIEWER 可讀取但不能直接寫 API，IT 不可管理使用者", async () => {
    expect(
      (
        await app.inject({
          url: "/api/assets",
          headers: { cookie: viewer.cookie },
        })
      ).statusCode,
    ).toBe(200);
    expect((await write("/api/assets", inputAsset(), viewer)).statusCode).toBe(
      403,
    );
    expect(
      (await write("/api/assignments", { assetId, employeeId }, viewer))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          url: "/api/users",
          headers: { cookie: itStaff.cookie },
        })
      ).statusCode,
    ).toBe(403);
  });
  it("拒絕缺少 CSRF 或錯誤 Origin 的寫入（包含登入）", async () => {
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/assignments",
          headers: { cookie: itStaff.cookie, origin },
          payload: { assetId, employeeId },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          headers: { origin: "https://evil.example" },
          payload: { email: "admin@example.test", password },
        })
      ).statusCode,
    ).toBe(403);
  });
  it("登出與到期後無法重用 Session", async () => {
    expect(
      (await write("/api/auth/logout", undefined, viewer)).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          url: "/api/assets",
          headers: { cookie: viewer.cookie },
        })
      ).statusCode,
    ).toBe(401);
    await db.session.updateMany({
      where: { userId: itStaff.id },
      data: { expiresAt: new Date(0) },
    });
    expect(
      (
        await app.inject({
          url: "/api/assets",
          headers: { cookie: itStaff.cookie },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("權限變更立即撤銷所有 Session，保護最後一位管理員", async () => {
    expect(
      (
        await write(
          `/api/users/${viewer.id}`,
          { role: "IT_STAFF", active: true },
          admin,
          "PATCH",
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          url: "/api/assets",
          headers: { cookie: viewer.cookie },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await write(
          `/api/users/${admin.id}`,
          { role: "VIEWER", active: true },
          admin,
          "PATCH",
        )
      ).statusCode,
    ).toBe(409);
  });
});
describe("資料管理、唯一性與歷史", () => {
  it("新增與更新資產、員工會寫入稽核；拒絕直接改狀態", async () => {
    const body = inputAsset();
    const created = await write("/api/assets", body);
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    expect(
      (
        await write(
          `/api/assets/${id}`,
          { ...body, location: "Floor 2" },
          itStaff,
          "PUT",
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await write(
          `/api/assets/${id}`,
          { ...body, status: "RETIRED" },
          itStaff,
          "PUT",
        )
      ).statusCode,
    ).toBe(400);
    const e = await write("/api/employees", {
      employeeNumber: "NEW-1",
      name: "New",
      email: "new@example.test",
      joinedAt: "2026-01-01",
      departmentId,
    });
    expect(e.statusCode).toBe(201);
    expect(await db.auditLog.count({ where: { targetId: id } })).toBe(2);
  });
  it("資產編號及有值序號大小寫正規化後唯一；空序號可多筆", async () => {
    const body = inputAsset();
    expect((await write("/api/assets", body)).statusCode).toBe(201);
    expect(
      (
        await write("/api/assets", {
          ...inputAsset(),
          assetTag: body.assetTag.toLowerCase(),
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await write("/api/assets", {
          ...inputAsset(),
          serialNumber: body.serialNumber.toLowerCase(),
        })
      ).statusCode,
    ).toBe(409);
    for (let i = 0; i < 2; i++)
      expect(
        (await write("/api/assets", { ...inputAsset(), serialNumber: "" }))
          .statusCode,
      ).toBe(201);
  });
  it("欄位驗證、無效日期、無效關聯與分頁上限回應 400", async () => {
    expect(
      (
        await write("/api/assets", {
          ...inputAsset(),
          purchasedAt: "2026-02-30",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await write("/api/assets", {
          ...inputAsset(),
          categoryId: "00000000-0000-4000-8000-000000000001",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          url: "/api/assets?pageSize=101",
          headers: { cookie: viewer.cookie },
        })
      ).statusCode,
    ).toBe(400);
  });
  it("搜尋、組合篩選、排序與分頁由伺服器執行", async () => {
    await makeAsset();
    const r = await app.inject({
      url: `/api/assets?search=Integration&status=AVAILABLE&categoryId=${categoryId}&pageSize=1&sort=assetTag&order=asc`,
      headers: { cookie: viewer.cookie },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().items).toHaveLength(1);
    expect(r.json().total).toBe(2);
  });
  it("除役保留歷史且不能再借出，無一般刪除端點", async () => {
    expect(
      (
        await write(`/api/assets/${assetId}/retire`, {
          reason: "End of lifecycle",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await write("/api/assignments", { assetId, employeeId })).statusCode,
    ).toBe(409);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/assets/${assetId}`,
          headers: { origin, cookie: admin.cookie, "x-csrf-token": admin.csrf },
        })
      ).statusCode,
    ).toBe(404);
    expect(
      await db.auditLog.count({
        where: { targetId: assetId, action: "ASSET_RETIRED" },
      }),
    ).toBe(1);
  });
});
describe("真實交易與並行領還", () => {
  it("借出、重複借出與歸還後狀態及歷史一致；重複歸還 409", async () => {
    const id = await checkout();
    expect(
      (await write("/api/assignments", { assetId, employeeId })).statusCode,
    ).toBe(409);
    expect(
      (
        await write(`/api/assignments/${id}/checkin`, {
          condition: "GOOD",
          notes: "All good",
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: assetId } })).status,
    ).toBe("AVAILABLE");
    expect(
      (await db.assetAssignment.findUniqueOrThrow({ where: { id } }))
        .returnedAt,
    ).not.toBeNull();
    expect(
      (await write(`/api/assignments/${id}/checkin`, { condition: "GOOD" }))
        .statusCode,
    ).toBe(409);
    expect(await db.auditLog.count({ where: { targetId: assetId } })).toBe(2);
  });
  it("8 個真正並行借出最多一筆成功、僅一筆有效領用與稽核", async () => {
    const employees = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        db.employee.create({
          data: {
            employeeNumber: `RACE-${i}`,
            name: `Race ${i}`,
            email: `race${i}@example.test`,
            departmentId,
            joinedAt: new Date("2024-01-01"),
          },
        }),
      ),
    );
    const results = await Promise.all(
      employees.map((e) =>
        write("/api/assignments", { assetId, employeeId: e.id }),
      ),
    );
    expect(results.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(results.filter((r) => r.statusCode === 409)).toHaveLength(7);
    expect(
      await db.assetAssignment.count({ where: { assetId, returnedAt: null } }),
    ).toBe(1);
    expect(
      await db.auditLog.count({
        where: { targetId: assetId, action: "CHECKOUT" },
      }),
    ).toBe(1);
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: assetId } })).status,
    ).toBe("ASSIGNED");
  });
  it("部分唯一索引即使繞過 service 也會阻擋第二筆有效領用", async () => {
    await checkout();
    await expect(
      db.assetAssignment.create({
        data: { assetId, employeeId, checkoutById: itStaff.id },
      }),
    ).rejects.toThrow();
  });
  it("稽核寫入失敗會回滾設備及領用，不留下半完成資料", async () => {
    await db.$executeRawUnsafe(
      `CREATE FUNCTION test_reject_checkout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'CHECKOUT' THEN RAISE EXCEPTION 'injected audit write failure'; END IF; RETURN NEW; END; $$`,
    );
    await db.$executeRawUnsafe(
      'CREATE TRIGGER test_reject_checkout BEFORE INSERT ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION test_reject_checkout()',
    );
    try {
      expect(
        (await write("/api/assignments", { assetId, employeeId })).statusCode,
      ).toBe(500);
      expect(
        (await db.asset.findUniqueOrThrow({ where: { id: assetId } })).status,
      ).toBe("AVAILABLE");
      expect(await db.assetAssignment.count({ where: { assetId } })).toBe(0);
      expect(await db.auditLog.count({ where: { targetId: assetId } })).toBe(0);
    } finally {
      await db.$executeRawUnsafe(
        'DROP TRIGGER test_reject_checkout ON "AuditLog"',
      );
      await db.$executeRawUnsafe("DROP FUNCTION test_reject_checkout()");
    }
  });
  it("兩個並行歸還僅成功一次", async () => {
    const id = await checkout();
    const results = await Promise.all([
      write(`/api/assignments/${id}/checkin`, { condition: "GOOD" }),
      write(`/api/assignments/${id}/checkin`, { condition: "GOOD" }),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect(
      await db.auditLog.count({
        where: { action: "CHECKIN", targetId: assetId },
      }),
    ).toBe(1);
  });
});
describe("維修與離職交接", () => {
  it("維修設備不可借出；進度與結案回到 AVAILABLE，重複結案 409", async () => {
    const r = await write("/api/maintenance", {
      assetId,
      description: "Screen repair",
    });
    expect(r.statusCode).toBe(201);
    const id = r.json().id as string;
    expect(
      (await write("/api/assignments", { assetId, employeeId })).statusCode,
    ).toBe(409);
    expect(
      (
        await write(
          `/api/maintenance/${id}`,
          { progress: "Waiting for parts", notes: "Ordered" },
          itStaff,
          "PATCH",
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (await write(`/api/maintenance/${id}/complete`, { outcome: "AVAILABLE" }))
        .statusCode,
    ).toBe(200);
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: assetId } })).status,
    ).toBe("AVAILABLE");
    expect(
      (await write(`/api/maintenance/${id}/complete`, { outcome: "AVAILABLE" }))
        .statusCode,
    ).toBe(409);
  });
  it("故障歸還自動送修，可維修結案為除役", async () => {
    const id = await checkout();
    expect(
      (await write(`/api/assignments/${id}/checkin`, { condition: "DAMAGED" }))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await write(`/api/assignments/${id}/checkin`, {
          condition: "DAMAGED",
          description: "Broken screen",
        })
      ).statusCode,
    ).toBe(200);
    const m = await db.maintenanceRecord.findFirstOrThrow({
      where: { assetId, completedAt: null },
    });
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: assetId } })).status,
    ).toBe("MAINTENANCE");
    expect(
      (await write(`/api/maintenance/${m.id}/complete`, { outcome: "RETIRED" }))
        .statusCode,
    ).toBe(200);
    expect(
      (await db.asset.findUniqueOrThrow({ where: { id: assetId } })).status,
    ).toBe("RETIRED");
  });
  it("仍有三項設備時不可完成交接；逐項歸還才可完成並保留歷史", async () => {
    const ids = [assetId, (await makeAsset()).id, (await makeAsset()).id],
      assignments: string[] = [];
    for (const id of ids) {
      const r = await write("/api/assignments", { assetId: id, employeeId });
      expect(r.statusCode).toBe(201);
      assignments.push(r.json().id);
    }
    const start = await write("/api/offboardings", {
      employeeId,
      plannedLeaveAt: "2027-01-01",
    });
    expect(start.statusCode).toBe(201);
    const id = start.json().id as string;
    const list = await app.inject({
      url: "/api/offboardings",
      headers: { cookie: viewer.cookie },
    });
    expect(list.json().items[0].employee.assignments).toHaveLength(3);
    expect((await write(`/api/offboardings/${id}/complete`)).statusCode).toBe(
      409,
    );
    for (const a of assignments)
      expect(
        (await write(`/api/assignments/${a}/checkin`, { condition: "GOOD" }))
          .statusCode,
      ).toBe(200);
    expect((await write(`/api/offboardings/${id}/complete`)).statusCode).toBe(
      200,
    );
    expect(
      (await db.employee.findUniqueOrThrow({ where: { id: employeeId } }))
        .status,
    ).toBe("INACTIVE");
    expect(await db.assetAssignment.count({ where: { employeeId } })).toBe(3);
    expect(
      await db.auditLog.count({
        where: { targetId: employeeId, action: "OFFBOARDING_COMPLETED" },
      }),
    ).toBe(1);
    expect(
      (await write("/api/assignments", { assetId, employeeId })).statusCode,
    ).toBe(409);
  });
  it("啟動交接與借出競態不會產生交接後新領用", async () => {
    const [a, o] = await Promise.all([
      write("/api/assignments", { assetId, employeeId }),
      write("/api/offboardings", { employeeId, plannedLeaveAt: "2027-01-01" }),
    ]);
    expect(o.statusCode).toBe(201);
    expect([201, 409]).toContain(a.statusCode);
    const count = await db.assetAssignment.count({
      where: { employeeId, returnedAt: null },
    });
    expect(
      (await write(`/api/offboardings/${o.json().id}/complete`)).statusCode,
    ).toBe(count ? 409 : 200);
    expect(
      (
        await write("/api/assignments", {
          assetId: (await makeAsset()).id,
          employeeId,
        })
      ).statusCode,
    ).toBe(409);
  });
  it("並行歸還與完成交接重新驗證條件，可安全重試", async () => {
    const assignment = await checkout();
    const o = await write("/api/offboardings", {
      employeeId,
      plannedLeaveAt: "2027-01-01",
    });
    const url = `/api/offboardings/${o.json().id}/complete`;
    const [returned, completed] = await Promise.all([
      write(`/api/assignments/${assignment}/checkin`, { condition: "GOOD" }),
      write(url),
    ]);
    expect(returned.statusCode).toBe(200);
    expect([200, 409]).toContain(completed.statusCode);
    if (completed.statusCode === 409)
      expect((await write(url)).statusCode).toBe(200);
    expect(
      await db.assetAssignment.count({
        where: { employeeId, returnedAt: null },
      }),
    ).toBe(0);
    expect(
      (await db.employee.findUniqueOrThrow({ where: { id: employeeId } }))
        .status,
    ).toBe("INACTIVE");
  });
});
describe("稽核、統計與契約", () => {
  it("Audit Log 在資料庫層拒絕 UPDATE / DELETE", async () => {
    await checkout();
    await expect(
      db.$executeRaw`UPDATE "AuditLog" SET result = 'FAKE' WHERE "targetId" = ${assetId}`,
    ).rejects.toThrow();
    await expect(
      db.$executeRaw`DELETE FROM "AuditLog" WHERE "targetId" = ${assetId}`,
    ).rejects.toThrow();
  });
  it("Dashboard 從資料庫統計，重新登入仍讀取相同資料", async () => {
    await checkout();
    const first = await app.inject({
      url: "/api/dashboard",
      headers: { cookie: viewer.cookie },
    });
    expect(first.json().total).toBe(1);
    expect(first.json().counts.ASSIGNED).toBe(1);
    expect(first.json().utilization).toBe(100);
    await write("/api/auth/logout", undefined, viewer);
    const again = await login("viewer@example.test");
    const result = await app.inject({
      url: "/api/assets",
      headers: { cookie: again.cookie },
    });
    expect(result.json().items[0].status).toBe("ASSIGNED");
  });
  it("OpenAPI 主要端點與實作一致且不外洩密碼欄位", async () => {
    const spec = (await app.inject("/openapi.json")).json();
    expect(spec.paths["/api/assignments"].post.requestBody).toBeDefined();
    expect(spec.paths["/api/offboardings/{id}/complete"].post).toBeDefined();
    const users = await app.inject({
      url: "/api/users",
      headers: { cookie: admin.cookie },
    });
    expect(users.body).not.toContain("passwordHash");
    expect(users.body).not.toContain(password);
  });
});
