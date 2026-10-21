import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { CurrentUser, Role } from "@assetflow/shared";
import { config } from "./config.js";
import { db } from "./db.js";
import { HttpError } from "./errors.js";
declare module "fastify" {
  interface FastifyRequest {
    user: CurrentUser | null;
    sessionId: string | null;
    csrfToken: string | null;
  }
}
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export const cookieName =
  config.NODE_ENV === "production" ? "__Host-assetflow" : "assetflow_session";
export const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "strict" as const,
  secure: config.NODE_ENV === "production",
};
export function permission(
  req: FastifyRequest,
  allowed: readonly Role[] = ["ADMIN", "IT_STAFF", "VIEWER"],
) {
  if (!req.user) throw new HttpError(401, "UNAUTHENTICATED", "請先登入。");
  if (!allowed.includes(req.user.role))
    throw new HttpError(403, "FORBIDDEN", "你沒有執行此操作的權限。");
  return req.user;
}
export function authentication(app: FastifyInstance) {
  app.decorateRequest("user", null);
  app.decorateRequest("sessionId", null);
  app.decorateRequest("csrfToken", null);
  app.addHook("onRequest", async (req) => {
    if (!req.url.startsWith("/api/")) return;
    const unsafe = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    if (unsafe && req.headers.origin !== config.APP_ORIGIN)
      throw new HttpError(403, "ORIGIN_REJECTED", "來源驗證失敗。");
    const raw = req.cookies[cookieName];
    if (raw && /^[a-f0-9]{64}$/.test(raw)) {
      const session = await db.session.findUnique({
        where: { tokenHash: hashToken(raw) },
        include: { user: true },
      });
      if (session && session.expiresAt > new Date() && session.user.active) {
        req.user = {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
        };
        req.sessionId = session.id;
        req.csrfToken = session.csrfToken;
      }
    }
    if (req.url.split("?")[0] === "/api/auth/login") return;
    permission(req);
    if (unsafe && req.headers["x-csrf-token"] !== req.csrfToken)
      throw new HttpError(403, "CSRF_REJECTED", "安全驗證已失效，請重新整理。");
  });
}
