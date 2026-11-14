import assert from "node:assert/strict";
import process from "node:process";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("provisioner refuses an unspecified or non-demo target before connecting", () => {
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/provision-demo.ts"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DEPLOYMENT_ENV: "production",
        DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/important_data",
        DEMO_PROVISION_CONFIRM: "",
      },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /explicitly identified HTTPS public-demo/);
  assert.doesNotMatch(result.stderr, /ECONNREFUSED/);
});
