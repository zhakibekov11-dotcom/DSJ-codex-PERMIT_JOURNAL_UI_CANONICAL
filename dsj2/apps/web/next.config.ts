import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);
const webAppRoot = path.dirname(fileURLToPath(import.meta.url));
const locatorProjectRoot = path.resolve(webAppRoot, "..", "..");
const locatorRuntimeStubPath = path.join(webAppRoot, "lib", "locator-runtime-stub.ts");
const locatorWebpackLoaderPath = path.join(webAppRoot, "lib", "locator-webpack-loader.cjs");
const locatorSolidJsWebDevPath = path.resolve(
  path.dirname(require.resolve("@locator/runtime/package.json")),
  "..",
  "..",
  "solid-js",
  "web",
  "dist",
  "dev.cjs",
);

function loadWorkspaceEnv(projectRoot: string) {
  for (const envFileName of [".env.local", ".env"]) {
    const envPath = path.join(projectRoot, envFileName);

    if (fs.existsSync(envPath)) {
      process.loadEnvFile(envPath);
    }
  }
}

loadWorkspaceEnv(locatorProjectRoot);

const enableLocator = process.env.NEXT_PUBLIC_ENABLE_LOCATOR === "1";

const nextConfig: NextConfig = {
  transpilePackages: ["@dsj/ui", "@dsj/utils", "@dsj/types"],
  outputFileTracingRoot: locatorProjectRoot,
  experimental: {
    devtoolSegmentExplorer: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ["sharp"],
  webpack: (config, { dev, isServer }) => {
    if (!enableLocator) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@locator/runtime": locatorRuntimeStubPath,
      };

      return config;
    }

    if (!dev || isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@locator/runtime": locatorRuntimeStubPath,
      };
    }

    if (dev && !isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "solid-js/web$": locatorSolidJsWebDevPath,
      };

      config.module.rules.push({
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: locatorWebpackLoaderPath,
            options: {
              cwd: locatorProjectRoot,
              env: "development",
            },
          },
        ],
      });
    }

    return config;
  },
};

export default nextConfig;
