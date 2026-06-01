import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const require = createRequire(import.meta.url);
const webAppRoot = path.dirname(fileURLToPath(import.meta.url));
const locatorProjectRoot = path.resolve(webAppRoot, "..", "..");
const outputFileTracingRoot =
  process.env.VERCEL === "1" ? path.resolve(locatorProjectRoot, "..") : locatorProjectRoot;
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
const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:13579 http://localhost:13579",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  transpilePackages: ["@dsj/ui", "@dsj/utils", "@dsj/types"],
  outputFileTracingRoot,
  experimental: {
    devtoolSegmentExplorer: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ["sharp"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
    ];
  },
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
