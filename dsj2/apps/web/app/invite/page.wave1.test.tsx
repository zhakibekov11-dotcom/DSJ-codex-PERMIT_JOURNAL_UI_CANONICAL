import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

test("invite page keeps the signing form behind the disabled branch", async () => {
  const currentDirectory = dirname(fileURLToPath(import.meta.url));
  const pageSource = await readFile(
    resolve(currentDirectory, "[token]", "page.tsx"),
    "utf8",
  );

  const disabledBranchIndex = pageSource.indexOf(") : !signingConfig.isConfigured ? (");
  const unavailableBranchIndex = pageSource.indexOf(") : !isSigningAvailable ? (");

  assert.notEqual(
    pageSource.indexOf(
      "const isSigningAvailable = signingConfig.isConfigured && invite.signingAvailable;",
    ),
    -1,
  );
  assert.notEqual(disabledBranchIndex, -1);
  assert.notEqual(unavailableBranchIndex, -1);
  assert.notEqual(pageSource.indexOf("invite.signingDigest"), -1);
  assert.notEqual(pageSource.indexOf("getSigningConfig"), -1);
  assert.notEqual(pageSource.indexOf("SigningForm"), -1);
  assert.ok(disabledBranchIndex < pageSource.indexOf("<SigningForm"));
  assert.ok(unavailableBranchIndex < pageSource.indexOf("<SigningForm"));
  assert.notEqual(pageSource.indexOf("invite.signingAvailable"), -1);
  assert.notEqual(pageSource.indexOf("publicInviteSignAction"), -1);
});
