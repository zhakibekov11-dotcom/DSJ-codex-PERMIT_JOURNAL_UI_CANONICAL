import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("journal sign page uses the shared signing form and provider config", async () => {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const pageSource = await readFile(resolve(currentDirectory, "page.tsx"), "utf8");

  assert.notEqual(pageSource.indexOf("getSigningConfig"), -1);
  assert.notEqual(pageSource.indexOf("SigningForm"), -1);
  assert.notEqual(pageSource.indexOf("signBriefingAction"), -1);
  assert.notEqual(pageSource.indexOf("documentHash: string | null"), -1);
  assert.notEqual(pageSource.indexOf("bridgeContext"), -1);
  assert.notEqual(pageSource.indexOf("session.user.fullName"), -1);
  assert.notEqual(pageSource.indexOf("signingConfig.isConfigured"), -1);
});
