import "server-only";

import { resolveSigningRuntimeConfig, type SigningRuntimeConfig } from "@dsj/types";

export type SigningConfig = SigningRuntimeConfig;

export function getSigningConfig(): SigningConfig {
  return resolveSigningRuntimeConfig({
    SIGNING_PROVIDER: process.env.SIGNING_PROVIDER,
    NCALAYER_BRIDGE_URL: process.env.NCALAYER_BRIDGE_URL,
    NCALAYER_BRIDGE_TIMEOUT_MS: process.env.NCALAYER_BRIDGE_TIMEOUT_MS,
    SIGNING_TEST_MODE: process.env.SIGNING_TEST_MODE,
  });
}
