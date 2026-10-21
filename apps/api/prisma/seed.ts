import "dotenv/config";
import argon2 from "argon2";
import { db, audit, transaction } from "../src/db.js";
import {
  checkout,
  checkin,
  startMaintenance,
  changeMaintenance,
  retire,
  startOffboarding,
  completeOffboarding,
} from "../src/services/lifecycle.js";
if (process.env.NODE_ENV === "production" || process.env.DEMO_SEED !== "true")
  throw new Error(
    "Demo seed requires DEMO_SEED=true and must never run in production.",
  );
const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12)
  throw new Error("Set an isolated DEMO_PASSWORD of at least 12 characters.");
try {
  const users = [];
  for (const [email, name, role] of [
    ["admin@assetflow.local", "林管理員", "ADMIN"],
    ["it@assetflow.local", "陳 IT 專員", "IT_STAFF"],
    ["viewer@assetflow.local", "王檢視者", "VIEWER"],
  ] as const) {
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    users.push(
      await db.user.upsert({
        where: { email },
        update: {},
        create: { email, name, role, passwordHash },
      }),
    );
  }
  const actor = users[0]!;
  const departments = [];
  for (const name of ["資訊科技部", "產品設計部", "業務營運部", "人力資源部"])
    departments.push(
      await db.department.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    );
  const categories = [];
  for (const name of ["筆記型電腦", "桌上型電腦", "顯示器", "周邊設備"])
    categories.push(
      await db.assetCategory.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    );
  const names = [
    "林予安",
    "陳以辰",
    "王思涵",
    "張子晴",
    "李承恩",
    "黃品蓉",
    "吳柏宇",
    "劉芷寧",
    "蔡庭瑋",
    "楊沛芸",
    "許宥翔",
    "鄭心妤",
    "謝佳穎",
    "郭家豪",
    "洪宜庭",
    "邱奕廷",
    "曾語彤",
    "廖冠廷",
    "賴欣怡",
    "周育誠",
  ];
  const employees = [];
  for (let i = 0; i < 20; i++) {
    const employeeNumber = `EMP-${String(i + 1).padStart(3, "0")}`;
    const existing = await db.employee.findUnique({
      where: { employeeNumber },
    });
    employees.push(
      existing ??
        (await transaction(async (tx) => {
          const employee = await tx.employee.create({
            data: {
              employeeNumber,
              name: names[i]!,
              departmentId: departments[i % 4]!.id,
              title: ["工程師", "設計師", "專員", "經理"][i % 4]!,
              email: `employee${i + 1}@example.test`,
              joinedAt: new Date("2024-01-15"),
            },
          });
          await audit(
            tx,
            actor.id,
            "EMPLOYEE_CREATED",
            "Employee",
            employee.id,
            { source: "DEMO_SEED" },
          );
          return employee;
        })),
    );
  }
  const models = [
    ["Apple", "MacBook Pro 14", "筆記型電腦"],
    ["Dell", "OptiPlex 7020", "桌上型電腦"],
    ["Dell", "UltraSharp U2723QE", "顯示器"],
    ["Logitech", "MX Keys", "周邊設備"],
  ] as const;
  const assets = [];
  for (let i = 0; i < 50; i++) {
    const assetTag = `AF-${String(i + 1).padStart(4, "0")}`;
    const existing = await db.asset.findUnique({ where: { assetTag } });
    if (existing) {
      assets.push(existing);
      continue;
    }
    const [brand, model] = models[i % 4]!;
    const asset = await transaction(async (tx) => {
      const created = await tx.asset.create({
        data: {
          assetTag,
          name: `${brand} ${model}`,
          categoryId: categories[i % 4]!.id,
          brand,
          model,
          serialNumber: `DEMO-${String(i + 1).padStart(6, "0")}`,
          purchasedAt: new Date("2025-03-01"),
          purchasePrice: [62900, 28000, 18000, 3590][i % 4]!,
          warrantyUntil: new Date("2028-03-01"),
          location: ["台北辦公室 · 3F", "台北辦公室 · 5F", "設備庫房 A"][
            i % 3
          ]!,
        },
      });
      await audit(tx, actor.id, "ASSET_CREATED", "Asset", created.id, {
        source: "DEMO_SEED",
      });
      return created;
    });
    assets.push(asset);
    if (i < 12)
      await checkout(actor.id, {
        assetId: asset.id,
        employeeId: employees[i % 8]!.id,
        expectedReturnAt: "2027-12-31",
        notes: "示範領用紀錄",
      });
    else if (i < 17)
      await startMaintenance(actor.id, {
        assetId: asset.id,
        description: "示範：設備需檢修",
        notes: "非正式業務資料",
      });
    else if (i < 20)
      await retire(actor.id, asset.id, "示範：設備已超過使用年限");
    else if (i === 20) {
      const a = await checkout(actor.id, {
        assetId: asset.id,
        employeeId: employees[10]!.id,
      });
      await checkin(actor.id, a.id, {
        condition: "GOOD",
        notes: "示範歷史：正常歸還",
      });
    } else if (i === 21) {
      const m = await startMaintenance(actor.id, {
        assetId: asset.id,
        description: "示範：更換鍵盤",
      });
      await changeMaintenance(actor.id, m.id, {
        outcome: "AVAILABLE",
        notes: "示範：已修復",
      });
    }
  }
  if (
    !(await db.offboarding.findFirst({
      where: { employeeId: employees[0]!.id },
    }))
  )
    await startOffboarding(actor.id, {
      employeeId: employees[0]!.id,
      plannedLeaveAt: "2027-01-31",
      notes: "示範：尚有設備待歸還",
    });
  if (
    !(await db.offboarding.findFirst({
      where: { employeeId: employees[19]!.id },
    }))
  ) {
    const o = await startOffboarding(actor.id, {
      employeeId: employees[19]!.id,
      plannedLeaveAt: "2026-10-01",
    });
    await completeOffboarding(actor.id, o.id);
  }
  console.log(
    "Demo seed complete: 3 users, 4 departments, 20 employees, 50 assets. Existing records and passwords preserved.",
  );
} finally {
  await db.$disconnect();
}
