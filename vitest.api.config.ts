import { defineConfig } from "vitest/config";
import "dotenv/config";
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("_test"))
  throw new Error(
    "TEST_DATABASE_URL must identify a dedicated *_test database.",
  );
export default defineConfig({
  test: {
    include: ["apps/api/test/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
    env: { DATABASE_URL: url, NODE_ENV: "test" },
  },
});
