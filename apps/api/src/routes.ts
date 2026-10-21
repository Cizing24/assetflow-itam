import type { FastifyInstance } from "fastify";
import argon2 from "argon2";
import { z } from "zod";
import { audit, db, transaction } from "./db.js";
import { config } from "./config.js";
import {
  permission,
  cookieName,
  cookieOptions,
  hashToken,
  newToken,
} from "./auth.js";
import { HttpError } from "./errors.js";
import * as s from "./schemas.js";
import * as lifecycle from "./services/lifecycle.js";
import * as catalog from "./services/catalog.js";
import * as queries from "./repositories/catalog.js";
const writers = ["ADMIN", "IT_STAFF"] as const;
const errorResponse = {
  type: "object",
  required: ["error"],
  properties: {
    error: {
      type: "object",
      required: ["code", "message", "requestId"],
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        requestId: { type: "string" },
      },
    },
  },
};
function responses(status = 200) {
  return {
    [status]: {
      type: "object",
      additionalProperties: true,
      description: "成功；完整欄位與範例請參閱 API.md",
    },
    400: errorResponse,
    401: errorResponse,
    403: errorResponse,
    404: errorResponse,
    409: errorResponse,
    429: errorResponse,
    500: errorResponse,
  };
}
function body(schema: z.ZodType, summary: string, tags: string[]) {
  return {
    summary,
    tags,
    body: z.toJSONSchema(schema, { io: "input", target: "draft-7" }),
    security: [{ sessionCookie: [], csrfToken: [] }],
    response: responses(),
  };
}
function created(schema: z.ZodType, summary: string, tags: string[]) {
  return { ...body(schema, summary, tags), response: responses(201) };
}
const read = (summary: string, tag: string) => ({
  summary,
  tags: [tag],
  security: [{ sessionCookie: [] }],
  response: responses(),
});
const querySchema = z.toJSONSchema(s.listSchema, {
  io: "input",
  target: "draft-7",
});
// HTTP query values are strings; Zod applies numeric coercion and limits after AJV.
const list = (summary: string, tag: string) => ({
  ...read(summary, tag),
  querystring: {
    ...querySchema,
    properties: {
      ...querySchema.properties,
      page: { type: "string", pattern: "^[0-9]+$", default: "1" },
      pageSize: { type: "string", pattern: "^[0-9]+$", default: "20" },
    },
  },
});
const pathId = (params: unknown) => s.idSchema.parse(params).id;
export function routes(app: FastifyInstance) {
  app.post(
    "/api/auth/login",
    {
      schema: {
        ...body(s.loginSchema, "登入並建立伺服器端 Session", [
          "Authentication",
        ]),
        security: [],
      },
      config: {
        rateLimit: {
          max: config.NODE_ENV === "test" ? 500 : 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (req, reply) => {
      const input = s.loginSchema.parse(req.body);
      const user = await db.user.findUnique({ where: { email: input.email } });
      // Always perform Argon2 verification to reduce account enumeration timing differences.
      const fallback =
        "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0c2FsdA$C1/2a3z03gMGq7vZ9J8F9a2/BwCdEFGHijklmNoPqrs";
      const valid = await argon2
        .verify(user?.passwordHash ?? fallback, input.password)
        .catch(() => false);
      if (!user || !user.active || !valid)
        throw new HttpError(
          401,
          "INVALID_CREDENTIALS",
          "電子郵件或密碼不正確。",
        );
      const token = newToken(),
        csrfToken = newToken();
      await transaction(async (tx) => {
        // Rotation prevents fixation; an existing browser session is invalidated on re-login.
        if (req.sessionId)
          await tx.session.deleteMany({ where: { id: req.sessionId } });
        await tx.session.deleteMany({
          where: { userId: user.id, expiresAt: { lt: new Date() } },
        });
        const session = await tx.session.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(token),
            csrfToken,
            expiresAt: new Date(Date.now() + config.SESSION_HOURS * 3600000),
          },
        });
        await audit(tx, user.id, "LOGIN", "Session", session.id, {
          authenticated: true,
        });
      });
      reply.setCookie(cookieName, token, {
        ...cookieOptions,
        maxAge: config.SESSION_HOURS * 3600,
      });
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        csrfToken,
      };
    },
  );
  app.get(
    "/api/auth/session",
    { schema: read("讀取目前登入狀態與 CSRF token", "Authentication") },
    async (req) => ({ user: req.user, csrfToken: req.csrfToken }),
  );
  app.post(
    "/api/auth/logout",
    { schema: read("登出並使 Session 失效", "Authentication") },
    async (req, reply) => {
      await transaction(async (tx) => {
        await tx.session.deleteMany({ where: { id: req.sessionId! } });
        await audit(tx, req.user!.id, "LOGOUT", "Session", req.sessionId!, {
          revoked: true,
        });
      });
      reply.clearCookie(cookieName, cookieOptions);
      return { ok: true };
    },
  );
  app.get(
    "/api/lookups",
    { schema: read("讀取分類、部門及可領用員工選項", "Catalog") },
    async () => ({
      categories: await db.assetCategory.findMany({ orderBy: { name: "asc" } }),
      departments: await db.department.findMany({ orderBy: { name: "asc" } }),
    }),
  );
  app.get(
    "/api/assets",
    { schema: list("分頁搜尋、狀態與分類篩選資產", "Assets") },
    (req) => queries.assets(s.listSchema.parse(req.query)),
  );
  app.get(
    "/api/assets/:id",
    { schema: read("資產詳情與完整領用、維修歷史", "Assets") },
    async (req) => {
      const asset = await db.asset.findUnique({
        where: { id: pathId(req.params) },
        include: {
          category: true,
          assignments: {
            include: {
              employee: true,
              checkoutBy: { select: queries.actorSelect },
              checkinBy: { select: queries.actorSelect },
            },
            orderBy: { checkedOutAt: "desc" },
          },
          maintenance: { orderBy: { startedAt: "desc" } },
        },
      });
      if (!asset) throw new HttpError(404, "NOT_FOUND", "找不到資產。");
      return asset;
    },
  );
  app.post(
    "/api/assets",
    { schema: created(s.assetSchema, "新增資產", ["Assets"]) },
    async (req, reply) => {
      const actor = permission(req, writers);
      return reply
        .code(201)
        .send(await catalog.saveAsset(actor.id, s.assetSchema.parse(req.body)));
    },
  );
  app.put(
    "/api/assets/:id",
    {
      schema: body(s.assetSchema, "更新資產基本資料（狀態由業務流程管理）", [
        "Assets",
      ]),
    },
    (req) =>
      catalog.saveAsset(
        permission(req, writers).id,
        s.assetSchema.parse(req.body),
        pathId(req.params),
      ),
  );
  app.post(
    "/api/assets/:id/retire",
    {
      schema: body(z.strictObject({ reason: s.text }), "除役閒置設備", [
        "Assets",
      ]),
    },
    (req) =>
      lifecycle.retire(
        permission(req, writers).id,
        pathId(req.params),
        z.object({ reason: s.text }).parse(req.body).reason,
      ),
  );
  app.get(
    "/api/employees",
    { schema: list("分頁搜尋、部門與在職狀態篩選員工", "Employees") },
    (req) => queries.employees(s.listSchema.parse(req.query)),
  );
  app.get(
    "/api/employees/:id",
    { schema: read("員工詳情、目前持有設備與領還歷史", "Employees") },
    async (req) => {
      const employee = await db.employee.findUnique({
        where: { id: pathId(req.params) },
        include: {
          department: true,
          assignments: {
            include: {
              asset: true,
              checkoutBy: { select: queries.actorSelect },
              checkinBy: { select: queries.actorSelect },
            },
            orderBy: { checkedOutAt: "desc" },
          },
          offboardings: true,
        },
      });
      if (!employee) throw new HttpError(404, "NOT_FOUND", "找不到員工。");
      return employee;
    },
  );
  app.post(
    "/api/employees",
    {
      schema: created(s.employeeSchema, "建立員工（與登入帳號獨立）", [
        "Employees",
      ]),
    },
    async (req, reply) =>
      reply
        .code(201)
        .send(
          await catalog.saveEmployee(
            permission(req, writers).id,
            s.employeeSchema.parse(req.body),
          ),
        ),
  );
  app.put(
    "/api/employees/:id",
    { schema: body(s.employeeSchema, "更新員工基本資料", ["Employees"]) },
    (req) =>
      catalog.saveEmployee(
        permission(req, writers).id,
        s.employeeSchema.parse(req.body),
        pathId(req.params),
      ),
  );
  app.get(
    "/api/assignments",
    { schema: list("查詢有效與歷史領用紀錄", "Assignments") },
    (req) => queries.assignments(s.listSchema.parse(req.query)),
  );
  app.post(
    "/api/assignments",
    {
      schema: created(s.checkoutSchema, "交易內借出設備並寫入稽核", [
        "Assignments",
      ]),
    },
    async (req, reply) =>
      reply
        .code(201)
        .send(
          await lifecycle.checkout(
            permission(req, writers).id,
            s.checkoutSchema.parse(req.body),
          ),
        ),
  );
  app.post(
    "/api/assignments/:id/checkin",
    {
      schema: body(s.checkinSchema, "歸還；故障設備自動建立維修", [
        "Assignments",
      ]),
    },
    (req) =>
      lifecycle.checkin(
        permission(req, writers).id,
        pathId(req.params),
        s.checkinSchema.parse(req.body),
      ),
  );
  app.get(
    "/api/maintenance",
    { schema: list("查詢維修紀錄與進度", "Maintenance") },
    (req) => queries.maintenance(s.listSchema.parse(req.query)),
  );
  app.post(
    "/api/maintenance",
    {
      schema: created(s.maintenanceSchema, "將可借出設備送修", ["Maintenance"]),
    },
    async (req, reply) =>
      reply
        .code(201)
        .send(
          await lifecycle.startMaintenance(
            permission(req, writers).id,
            s.maintenanceSchema.parse(req.body),
          ),
        ),
  );
  app.patch(
    "/api/maintenance/:id",
    {
      schema: body(s.maintenanceUpdateSchema, "更新未結案維修進度", [
        "Maintenance",
      ]),
    },
    (req) =>
      lifecycle.changeMaintenance(
        permission(req, writers).id,
        pathId(req.params),
        s.maintenanceUpdateSchema.parse(req.body),
      ),
  );
  app.post(
    "/api/maintenance/:id/complete",
    {
      schema: body(s.completeMaintenanceSchema, "維修完成；恢復可借出或除役", [
        "Maintenance",
      ]),
    },
    (req) =>
      lifecycle.changeMaintenance(
        permission(req, writers).id,
        pathId(req.params),
        s.completeMaintenanceSchema.parse(req.body),
      ),
  );
  app.get(
    "/api/offboardings",
    { schema: list("查詢交接並即時列出未歸還設備", "Offboarding") },
    (req) => queries.offboardings(s.listSchema.parse(req.query)),
  );
  app.post(
    "/api/offboardings",
    {
      schema: created(s.offboardingSchema, "啟動離職交接並停止新增領用", [
        "Offboarding",
      ]),
    },
    async (req, reply) =>
      reply
        .code(201)
        .send(
          await lifecycle.startOffboarding(
            permission(req, writers).id,
            s.offboardingSchema.parse(req.body),
          ),
        ),
  );
  app.post(
    "/api/offboardings/:id/complete",
    {
      schema: body(
        s.completeOffboardingSchema,
        "確認實際離職日期並重新驗證無未歸還設備後完成交接",
        ["Offboarding"],
      ),
    },
    (req) =>
      lifecycle.completeOffboarding(
        permission(req, writers).id,
        pathId(req.params),
        s.completeOffboardingSchema.parse(req.body),
      ),
  );
  app.get(
    "/api/audit-logs",
    { schema: list("唯讀操作稽核紀錄", "Audit") },
    (req) => queries.auditLogs(s.listSchema.parse(req.query)),
  );
  app.get(
    "/api/dashboard",
    { schema: read("資料庫一致快照統計", "Dashboard") },
    () => queries.dashboard(),
  );
  app.get(
    "/api/users",
    { schema: list("管理員查詢系統使用者", "Users") },
    async (req) => {
      permission(req, ["ADMIN"]);
      const q = s.listSchema.parse(req.query);
      const where = q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: "insensitive" as const } },
              { email: { contains: q.search, mode: "insensitive" as const } },
            ],
          }
        : {};
      const [items, total] = await db.$transaction([
        db.user.findMany({
          where,
          select: catalog.userSelect,
          take: q.pageSize,
          skip: (q.page - 1) * q.pageSize,
          orderBy: { createdAt: "desc" },
        }),
        db.user.count({ where }),
      ]);
      return { items, total, page: q.page, pageSize: q.pageSize };
    },
  );
  app.post(
    "/api/users",
    { schema: created(s.userSchema, "管理員建立系統使用者", ["Users"]) },
    async (req, reply) =>
      reply
        .code(201)
        .send(
          await catalog.createUser(
            permission(req, ["ADMIN"]).id,
            s.userSchema.parse(req.body),
          ),
        ),
  );
  app.patch(
    "/api/users/:id",
    {
      schema: body(
        s.userUpdateSchema,
        "管理員變更角色與啟用狀態並撤銷 Session",
        ["Users"],
      ),
    },
    (req) =>
      catalog.updateUser(
        permission(req, ["ADMIN"]).id,
        pathId(req.params),
        s.userUpdateSchema.parse(req.body),
      ),
  );
}
