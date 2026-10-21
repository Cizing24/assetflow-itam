import { writeFile } from "node:fs/promises";
import { format } from "prettier";
import { buildApp } from "../apps/api/src/app.js";
import { db } from "../apps/api/src/db.js";
const app = await buildApp();
try {
  await app.ready();
  await writeFile(
    "docs/openapi.json",
    await format(JSON.stringify(app.swagger()), { parser: "json" }),
  );
  console.log("Exported route-generated OpenAPI to docs/openapi.json");
} finally {
  await app.close();
  await db.$disconnect();
}
