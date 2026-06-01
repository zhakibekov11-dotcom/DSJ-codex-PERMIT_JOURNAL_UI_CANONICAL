import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("employee instruction page routes signing through the shared signing form", async () => {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const pageSource = await readFile(resolve(currentDirectory, "page.tsx"), "utf8");

  assert.notEqual(pageSource.indexOf("getSigningConfig"), -1);
  assert.notEqual(pageSource.indexOf("SigningForm"), -1);
  assert.notEqual(pageSource.indexOf("signMyInstructionAction"), -1);
  assert.notEqual(pageSource.indexOf("record.signingDigest"), -1);
  assert.notEqual(pageSource.indexOf("const canSign ="), -1);
  assert.notEqual(pageSource.indexOf("id=\"signing-card\""), -1);
  assert.notEqual(pageSource.indexOf("bridgeContext"), -1);
  assert.notEqual(pageSource.indexOf("signingConfig.isConfigured"), -1);
});
