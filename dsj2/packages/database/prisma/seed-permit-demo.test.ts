import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { test } from "node:test";

const tsxCliPath = require.resolve("tsx/cli");
const packageDirectory = resolve(__dirname, "..");
const localDatabaseUrl =
  "postgresql://dsj:dsj@127.0.0.1:1/dsj_local?schema=public";

function runFixture(overrides: Record<string, string | undefined>) {
  return new Promise<{ code: number | null; output: string }>(
    (resolvePromise, rejectPromise) => {
      const child = spawn(
        process.execPath,
        [tsxCliPath, "prisma/seed-permit-demo.ts"],
        {
          cwd: packageDirectory,
          env: { ...process.env, ...overrides },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      let output = "";
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        rejectPromise(new Error("Permit demo fixture guard test timed out."));
      }, 15000);
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });
      child.stderr.on("data", (chunk) => {
        output += chunk.toString();
      });
      child.on("error", rejectPromise);
      child.on("close", (code) => {
        clearTimeout(timeout);
        resolvePromise({ code, output });
      });
    },
  );
}

test("permit demo fixture requires its explicit enable flag", async () => {
  const result = await runFixture({
    DATABASE_URL: localDatabaseUrl,
    NODE_ENV: "development",
    PERMIT_DEMO_SEED_ENABLED: undefined,
    PERMIT_DEMO_USER_PASSWORD: "local-demo-password",
  });

  assert.notEqual(result.code, 0);
  assert.match(
    result.output,
    /Refusing to run without PERMIT_DEMO_SEED_ENABLED=true\./,
  );
});

test("permit demo fixture refuses production", async () => {
  const result = await runFixture({
    DATABASE_URL: localDatabaseUrl,
    NODE_ENV: "production",
    PERMIT_DEMO_SEED_ENABLED: "true",
    PERMIT_DEMO_USER_PASSWORD: "local-demo-password",
  });

  assert.notEqual(result.code, 0);
  assert.match(
    result.output,
    /Refusing to run the permit demo fixture in production\./,
  );
});

test("permit demo fixture refuses non-local databases", async () => {
  const result = await runFixture({
    DATABASE_URL: "postgresql://dsj:dsj@db.example.com:5432/dsj",
    NODE_ENV: "development",
    PERMIT_DEMO_SEED_ENABLED: "true",
    PERMIT_DEMO_USER_PASSWORD: "local-demo-password",
  });

  assert.notEqual(result.code, 0);
  assert.match(
    result.output,
    /Refusing to run the permit demo fixture against a non-local DATABASE_URL\./,
  );
});

test("permit demo fixture requires an explicit password", async () => {
  const result = await runFixture({
    DATABASE_URL: localDatabaseUrl,
    NODE_ENV: "development",
    PERMIT_DEMO_SEED_ENABLED: "true",
    PERMIT_DEMO_USER_PASSWORD: undefined,
  });

  assert.notEqual(result.code, 0);
  assert.match(result.output, /PERMIT_DEMO_USER_PASSWORD is required\./);
});
