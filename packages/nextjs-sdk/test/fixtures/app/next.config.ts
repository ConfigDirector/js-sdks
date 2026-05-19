import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve the nextjs-sdk source and internal monorepo packages from source so the fixture
// exercises SDK source directly without requiring a build step — mirroring the same alias
// strategy used by the nuxt-sdk fixture.
const sdkSrc = resolve(__dirname, "../../../src");
const packages = resolve(__dirname, "../../../../");

const alias: Record<string, string> = {
  "@configdirector/nextjs-sdk/server": resolve(sdkSrc, "server/index.ts"),
  "@configdirector/nextjs-sdk/client": resolve(sdkSrc, "client/index.ts"),
  "@js-client-core": resolve(packages, "js-client-core/src"),
  "@js-browser-client": resolve(packages, "js-browser-client/src"),
  "@js-server-sdk": resolve(packages, "js-server-sdk/src"),
  "@shared": resolve(packages, "shared/src"),
  "@eventsource": resolve(packages, "eventsource/src"),
  "@config-evaluator": resolve(packages, "config-evaluator/src"),
};

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias = { ...config.resolve.alias, ...alias };
    return config;
  },
};

export default nextConfig;
