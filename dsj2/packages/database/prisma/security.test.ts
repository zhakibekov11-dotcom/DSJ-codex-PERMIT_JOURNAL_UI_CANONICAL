import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateInviteToken,
  hashInviteToken,
  hashSensitiveValue,
  hashSensitiveValueLegacy,
} from "../src/security";

process.env.FIELD_HASH_PEPPER = "database-security-test-pepper-value";
process.env.FIELD_ENCRYPTION_KEY = "database-security-test-encryption-key";

test("sensitive hashes use HMAC and keep legacy helper for transition", () => {
  const iin = "980317350011";
  const current = hashSensitiveValue(iin);
  const legacy = hashSensitiveValueLegacy(iin);

  assert.equal(current, hashSensitiveValue(iin));
  assert.notEqual(current, legacy);
  assert.match(current, /^[a-f0-9]{64}$/);
  assert.match(legacy, /^[a-f0-9]{64}$/);
});

test("invite tokens are high entropy and stored as hashes", () => {
  const token = generateInviteToken();
  const secondToken = generateInviteToken();
  const tokenHash = hashInviteToken(token);

  assert.ok(token.length >= 43);
  assert.notEqual(token, secondToken);
  assert.notEqual(tokenHash, token);
  assert.equal(tokenHash, hashInviteToken(token));
  assert.match(tokenHash, /^[a-f0-9]{64}$/);
});
