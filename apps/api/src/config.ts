import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";
loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});
const schema = z.object({
  DATABASE_URL: z.string().startsWith("postgresql://"),
  APP_ORIGIN: z.url().default("http://localhost:5173"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  SESSION_HOURS: z.coerce.number().min(0.01).max(24).default(8),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});
export const config = schema.parse(process.env);
if (
  config.NODE_ENV === "production" &&
  !config.APP_ORIGIN.startsWith("https://")
)
  throw new Error("Production requires an HTTPS APP_ORIGIN");
