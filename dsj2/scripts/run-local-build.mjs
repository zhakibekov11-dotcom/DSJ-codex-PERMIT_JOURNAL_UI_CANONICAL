import { spawnSync } from "node:child_process";

process.env.APP_URL ||= "http://localhost:3000";
process.env.API_URL ||= "http://localhost:4000";

const result = spawnSync("corepack", ["pnpm", "build"], {
  env: process.env,
  shell: process.platform === "win32",
  stdio: "inherit",
});

process.exit(result.status ?? 1);
