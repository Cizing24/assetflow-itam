import "dotenv/config";
import argon2 from "argon2";

// Provision a new, explicitly identified demo database; never reset an existing one.
const target = new URL(
  process.env.DATABASE_URL ?? "postgresql://invalid/invalid",
);
if (
  process.env.DEPLOYMENT_ENV !== "public-demo" ||
  process.env.DEMO_PROVISION_CONFIRM !== "CREATE_SYNTHETIC_DEMO" ||
  !process.env.DEMO_DATABASE_HOST ||
  target.hostname !== process.env.DEMO_DATABASE_HOST ||
  target.pathname !== "/assetflow_demo" ||
  !process.env.APP_ORIGIN?.startsWith("https://")
)
  throw new Error(
    "Provisioning requires the explicitly identified HTTPS public-demo database.",
  );

const accounts = [
  ["admin", "ADMIN", process.env.DEMO_ADMIN_PASSWORD],
  ["it", "IT_STAFF", process.env.DEMO_IT_PASSWORD],
  ["viewer", "VIEWER", process.env.DEMO_VIEWER_PASSWORD],
] as const;
if (accounts.some(([, , password]) => !password || password.length < 24))
  throw new Error(
    "Provide separate demo account passwords of at least 24 characters.",
  );
if (
  new Set(accounts.map(([, , password]) => password)).size !== accounts.length
)
  throw new Error("Privileged and public viewer passwords must be different.");

const { db, transaction, audit } = await import("../apps/api/src/db.js");
try {
  await transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261114)`;
    const identity = await tx.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`;
    if (identity[0]?.name !== "assetflow_demo")
      throw new Error("Database identity mismatch.");
    if (
      (await tx.user.count()) ||
      (await tx.asset.count()) ||
      (await tx.auditLog.count())
    )
      throw new Error(
        "Provisioning refuses a populated database; existing data is preserved.",
      );
    const users = [];
    for (const [alias, role, password] of accounts)
      users.push(
        await tx.user.create({
          data: {
            email: `${alias}@assetflow.example.test`,
            name: `合成示範 ${alias}`,
            role,
            passwordHash: await argon2.hash(password!, {
              type: argon2.argon2id,
            }),
          },
        }),
      );
    const actor = users[0]!;
    const department = await tx.department.create({
      data: { name: "合成展示部門" },
    });
    const category = await tx.assetCategory.create({
      data: { name: "示範筆記型電腦" },
    });
    for (let index = 1; index <= 4; index++) {
      const employee = await tx.employee.create({
        data: {
          employeeNumber: `DEMO-${index}`,
          name: `合成員工 ${index}`,
          email: `employee-${index}@example.test`,
          departmentId: department.id,
          joinedAt: new Date("2026-01-01"),
          title: "示範人員",
        },
      });
      await audit(tx, actor.id, "EMPLOYEE_CREATED", "Employee", employee.id, {
        source: "PUBLIC_DEMO_PROVISION",
      });
      const asset = await tx.asset.create({
        data: {
          assetTag: `DEMO-${index}`,
          name: `合成展示設備 ${index}`,
          categoryId: category.id,
          brand: "Demo",
          model: "Synthetic",
          purchasedAt: new Date("2026-01-01"),
          location: "合成展示室",
        },
      });
      await audit(tx, actor.id, "ASSET_CREATED", "Asset", asset.id, {
        source: "PUBLIC_DEMO_PROVISION",
      });
    }
    await audit(tx, actor.id, "PUBLIC_DEMO_PROVISIONED", "User", actor.id, {
      environment: "public-demo",
      publicRole: "VIEWER",
    });
  });
  console.log(
    "Synthetic demo provisioned. Credentials are supplied through the protected environment only.",
  );
} finally {
  await db.$disconnect();
}
