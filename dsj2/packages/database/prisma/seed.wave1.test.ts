import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { resolve } from "node:path";

const tsxCliPath = require.resolve("tsx/cli");
const prismaDirectory = __dirname;
const packageDirectory = resolve(prismaDirectory, "..");
const guardedLocalDatabaseUrl =
  "postgresql://dsj:dsj@127.0.0.1:1/dsj_local?schema=public";
const explicitSeedCredentials = {
  SEED_SUPER_ADMIN_EMAIL: "seed.super-admin@example.test",
  SEED_SUPER_ADMIN_PASSWORD: "seed-super-admin-password",
  SEED_COMPANY_ADMIN_EMAIL: "seed.company-admin@example.test",
  SEED_COMPANY_ADMIN_PASSWORD: "seed-company-admin-password",
};

type SeedRunResult = {
  code: number | null;
  output: string;
};

function runSeed(overrides: Record<string, string | undefined>) {
  return new Promise<SeedRunResult>((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [tsxCliPath, "prisma/seed.ts"], {
      cwd: packageDirectory,
      env: {
        ...process.env,
        ...overrides,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      rejectPromise(new Error("Seed verification timed out."));
    }, 15000);

    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectPromise(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolvePromise({
        code,
        output,
      });
    });
  });
}

test("seed aborts without DATABASE_URL", async () => {
  const result = await runSeed({
    DATABASE_URL: undefined,
    NODE_ENV: "development",
    SEED_ALLOW_DESTRUCTIVE_RESET: "true",
  });

  assert.notEqual(result.code, 0);
  assert.match(
    result.output,
    /DATABASE_URL is required before running the destructive seed\./,
  );
});

test("seed aborts when NODE_ENV=production even with the destructive flag", async () => {
  const result = await runSeed({
    DATABASE_URL: guardedLocalDatabaseUrl,
    NODE_ENV: "production",
    SEED_ALLOW_DESTRUCTIVE_RESET: "true",
  });

  assert.notEqual(result.code, 0);
  assert.match(
    result.output,
    /Refusing to run the destructive seed when NODE_ENV=production\./,
  );
});

test("seed aborts when the destructive reset flag is missing", async () => {
  const result = await runSeed({
    DATABASE_URL: guardedLocalDatabaseUrl,
    NODE_ENV: "development",
    SEED_ALLOW_DESTRUCTIVE_RESET: undefined,
  });

  assert.notEqual(result.code, 0);
  assert.match(
    result.output,
    /Refusing to run the destructive seed without SEED_ALLOW_DESTRUCTIVE_RESET=true\./,
  );
});

test("seed aborts when DATABASE_URL is not local", async () => {
  const result = await runSeed({
    DATABASE_URL: "postgresql://dsj:dsj@db.example.com:5432/dsj?schema=public",
    NODE_ENV: "development",
    SEED_ALLOW_DESTRUCTIVE_RESET: "true",
  });

  assert.notEqual(result.code, 0);
  assert.match(
    result.output,
    /Refusing to run the destructive seed against a non-local DATABASE_URL\./,
  );
});

test("seed clears the safety gate only for the explicit local non-production case", async () => {
  const result = await runSeed({
    ...explicitSeedCredentials,
    DATABASE_URL: guardedLocalDatabaseUrl,
    NODE_ENV: "development",
    SEED_ALLOW_DESTRUCTIVE_RESET: "true",
  });

  assert.notEqual(result.code, 0);
  assert.doesNotMatch(result.output, /Refusing to run the destructive seed/);
  assert.doesNotMatch(
    result.output,
    /DATABASE_URL is required before running the destructive seed\./,
  );
});

test("seed aborts when the super-admin password is not configured explicitly", async () => {
  const result = await runSeed({
    ...explicitSeedCredentials,
    DATABASE_URL: guardedLocalDatabaseUrl,
    NODE_ENV: "development",
    SEED_ALLOW_DESTRUCTIVE_RESET: "true",
    SEED_SUPER_ADMIN_PASSWORD: undefined,
  });

  assert.notEqual(result.code, 0);
  assert.match(
    result.output,
    /SEED_SUPER_ADMIN_PASSWORD is required before running the destructive seed\./,
  );
});

test("seed aborts when the company-admin email is not configured explicitly", async () => {
  const result = await runSeed({
    ...explicitSeedCredentials,
    DATABASE_URL: guardedLocalDatabaseUrl,
    NODE_ENV: "development",
    SEED_ALLOW_DESTRUCTIVE_RESET: "true",
    SEED_COMPANY_ADMIN_EMAIL: undefined,
  });

  assert.notEqual(result.code, 0);
  assert.match(
    result.output,
    /SEED_COMPANY_ADMIN_EMAIL is required before running the destructive seed\./,
  );
});
