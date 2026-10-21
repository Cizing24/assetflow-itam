// Uses the OS Git credential manager in memory; never writes or prints credentials.
import { execFileSync } from "node:child_process";
import process from "node:process";
import console from "node:console";
import { fetch } from "undici";
let credential;
try {
  credential = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    env: { ...process.env, GCM_INTERACTIVE: "Never" },
    stdio: ["pipe", "pipe", "ignore"],
  });
} catch {
  console.error("GitHub credential unavailable in Git credential manager.");
  process.exit(2);
}
const password = credential.match(/^password=(.+)$/m)?.[1];
if (!password) {
  console.error("No usable GitHub credential.");
  process.exit(2);
}
async function request(path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${password}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(
        `GitHub request failed: ${response.status} ${data.message ?? ""}`,
      ),
      { status: response.status },
    );
  return data;
}
try {
  const user = await request("/user");
  const repository = `${user.login}/assetflow-itam`;
  if (process.argv[2] === "create") {
    let exists = false;
    try {
      await request(`/repos/${repository}`);
      exists = true;
    } catch (e) {
      if (e.status !== 404) throw e;
    }
    if (exists)
      throw new Error(
        `Repository ${repository} already exists. No creation or overwrite performed.`,
      );
    const repo = await request("/user/repos", {
      name: "assetflow-itam",
      private: true,
      description:
        "AssetFlow — Vue 3 + Fastify + PostgreSQL IT asset lifecycle management",
      auto_init: false,
    });
    console.log(
      JSON.stringify({
        url: repo.html_url,
        private: repo.private,
        cloneUrl: repo.clone_url,
      }),
    );
  } else if (process.argv[2] === "runs") {
    const result = await request(
      `/repos/${repository}/actions/runs?per_page=5`,
    );
    console.log(
      JSON.stringify(
        result.workflow_runs.map((r) => ({
          id: r.id,
          sha: r.head_sha,
          status: r.status,
          conclusion: r.conclusion,
          url: r.html_url,
        })),
        null,
        2,
      ),
    );
  } else {
    console.log(
      JSON.stringify({ login: user.login, credentialAvailable: true }),
    );
  }
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
