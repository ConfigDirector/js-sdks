import type { ConfigDirectorClient, ConfigDirectorClientOptions } from "@js-server-sdk/types";
import { createDefaultLogger } from "./logger";
import { ConfigDirectorInitializationError } from "@shared/errors";

declare global {
  var __configDirectorServerClient: ConfigDirectorClient | undefined;
  var __configDirectorAppMeta: { appName?: string; appVersion?: string } | undefined;
}

export type RegisterOptions = {
  /**
   * Your ConfigDirector Server SDK key. This is a secret value — do not commit it to source
   * control. Provide it via an environment variable (e.g. process.env.CONFIGDIRECTOR_SERVER_KEY).
   */
  serverSdkKey: string;
} & ConfigDirectorClientOptions;

/**
 * Initializes the ConfigDirector server SDK singleton. Call this from your Next.js
 * `instrumentation.ts` file so it runs once when the server starts:
 *
 * ```ts
 * // instrumentation.ts
 * export async function register() {
 *   const { register } = await import("@configdirector/nextjs-sdk/server");
 *   await register({ serverSdkKey: process.env.CONFIGDIRECTOR_SERVER_KEY! });
 * }
 * ```
 */
export async function register(options: RegisterOptions): Promise<void> {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") {
    return;
  }

  if (!options.serverSdkKey) {
    const message =
      "The ConfigDirector serverSdkKey must be provided to register(). You can pass it via process.env.CONFIGDIRECTOR_SERVER_KEY.";
    createDefaultLogger().error(message);
    throw new ConfigDirectorInitializationError(message);
  }

  if (!globalThis.__configDirectorServerClient) {
    const { DefaultConfigDirectorClient } = await import("@js-server-sdk/DefaultConfigDirectorClient");
    const { serverSdkKey, ...clientOptions } = options;
    globalThis.__configDirectorAppMeta = {
      appName: options.metadata?.appName,
      appVersion: options.metadata?.appVersion,
    };
    const client = new DefaultConfigDirectorClient(
      serverSdkKey,
      { sdkName: "nextjs-sdk", sdkVersion: "__VERSION__" },
      clientOptions,
    );
    globalThis.__configDirectorServerClient = client;
    await client.initialize();
  }
}

export function getAppMeta(): { appName?: string; appVersion?: string } {
  return globalThis.__configDirectorAppMeta ?? {};
}

export function getConfigClient(): ConfigDirectorClient {
  if (!globalThis.__configDirectorServerClient) {
    throw new ConfigDirectorInitializationError(
      "[ConfigDirector] Server client not initialized. Make sure to call register() in your instrumentation.ts file before using the SDK.",
    );
  }
  return globalThis.__configDirectorServerClient;
}
