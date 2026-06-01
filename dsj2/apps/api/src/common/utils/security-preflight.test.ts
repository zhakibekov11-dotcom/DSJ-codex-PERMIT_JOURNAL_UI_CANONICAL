import assert from "node:assert/strict";
import { test } from "node:test";
import { validateSecurityConfig } from "./security-preflight";

const validProductionEnv = {
  NODE_ENV: "production",
  JWT_SECRET: "jwt-secret-with-at-least-thirty-two-chars",
  FIELD_ENCRYPTION_KEY: "field-encryption-key-with-32-chars",
  FIELD_HASH_PEPPER: "field-hash-pepper-with-at-least-32-chars",
  APP_URL: "https://app.example.com",
  CORS_ORIGIN: "https://app.example.com",
  EGOV_MOBILE_QR_ENABLED: "false",
};

test("security preflight accepts strong production config", () => {
  assert.doesNotThrow(() => validateSecurityConfig(validProductionEnv));
});

test("security preflight rejects placeholder JWT secrets", () => {
  assert.throws(
    () =>
      validateSecurityConfig({
        ...validProductionEnv,
        JWT_SECRET: "replace-with-a-long-random-secret",
      }),
    /JWT_SECRET/,
  );
});

test("security preflight rejects unsafe production APP_URL and wildcard CORS", () => {
  assert.throws(
    () =>
      validateSecurityConfig({
        ...validProductionEnv,
        APP_URL: "http://app.example.com",
      }),
    /APP_URL/,
  );

  assert.throws(
    () =>
      validateSecurityConfig({
        ...validProductionEnv,
        CORS_ORIGIN: "*",
      }),
    /CORS_ORIGIN/,
  );
});

test("security preflight requires eGov callback secret unless local simulation is explicit", () => {
  assert.throws(
    () =>
      validateSecurityConfig({
        ...validProductionEnv,
        EGOV_MOBILE_QR_ENABLED: "true",
        EGOV_MOBILE_QR_CALLBACK_SECRET: "",
      }),
    /EGOV_MOBILE_QR_CALLBACK_SECRET/,
  );

  assert.doesNotThrow(() =>
    validateSecurityConfig({
      NODE_ENV: "development",
      JWT_SECRET: "dev-jwt-secret-strong",
      FIELD_ENCRYPTION_KEY: "dev-field-encryption-key",
      FIELD_HASH_PEPPER: "dev-field-hash-pepper",
      APP_URL: "http://localhost:3000",
      CORS_ORIGIN: "http://localhost:3000",
      EGOV_MOBILE_QR_ENABLED: "true",
      EGOV_MOBILE_QR_ALLOW_LOCAL_CALLBACK_SIMULATION: "true",
    }),
  );
});
