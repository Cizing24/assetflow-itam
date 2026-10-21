import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { setTimeout } from "node:timers/promises";
import { config } from "./config.js";
import { HttpError } from "./errors.js";
export const db = new PrismaClient({
  // Existing TIMESTAMP(3) columns store UTC wall-clock values. Pin DB defaults
  // (now()) as well as Prisma reads/writes to UTC, regardless of server timezone.
  adapter: new PrismaPg({
    connectionString: config.DATABASE_URL,
    options: "-c timezone=UTC",
  }),
});
export type Transaction = Prisma.TransactionClient;
function retryable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034") return true;
    if (error.code === "P2010" && error.meta?.driverAdapterError)
      return retryable(error.meta.driverAdapterError);
  }
  // The JS PostgreSQL adapter can surface SQLSTATE directly when COMMIT fails.
  if (typeof error !== "object" || error === null) return false;
  const cause = "cause" in error ? error.cause : null;
  return (
    typeof cause === "object" &&
    cause !== null &&
    "originalCode" in cause &&
    ["40001", "40P01"].includes(String(cause.originalCode))
  );
}
export async function transaction<T>(
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 10000,
      });
    } catch (error) {
      if (retryable(error)) {
        if (attempt < 4) {
          await setTimeout(10 * 2 ** attempt + Math.random() * 10);
          continue;
        }
        throw new HttpError(
          409,
          "CONCURRENT_CHANGE",
          "資料同時被更新，請重新整理後再試。",
        );
      }
      throw error;
    }
  }
}
export async function lockEmployee(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM "Employee" WHERE id = ${id} FOR UPDATE`;
  const employee = await tx.employee.findUnique({ where: { id } });
  if (!employee) throw new HttpError(404, "NOT_FOUND", "找不到員工。");
  return employee;
}
export async function lockAsset(tx: Transaction, id: string) {
  await tx.$queryRaw`SELECT id FROM "Asset" WHERE id = ${id} FOR UPDATE`;
  const asset = await tx.asset.findUnique({ where: { id } });
  if (!asset) throw new HttpError(404, "NOT_FOUND", "找不到資產。");
  return asset;
}
export function audit(
  tx: Transaction,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  changes: Prisma.InputJsonValue,
) {
  return tx.auditLog.create({
    data: { actorId, action, targetType, targetId, changes },
  });
}
