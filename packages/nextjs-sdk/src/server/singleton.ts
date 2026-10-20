import type {
  ConfigDirectorClient,
  ConfigDirectorClientOptions,
  ConnectionMode,
  OfflineClientOptions,
} from "@js-server-sdk/types";
import { createDefaultLogger } from "./logger";
import { ConfigDirectorInitializationError } from "@shared/errors";

declare global {
  var __configDirectorServerClient: ConfigDirectorClient | undefined;
  var __configDirectorServerConnectionMode: ConnectionMode | undefined;
  var __configDirectorAppMeta: { appName?: string; appVersion?: string } | undefined;
}

/**
 * Options of {@link register}. A server SDK key is required unless `connection.mode` is `offline`,
 * in which case the server singleton never connects and serves `connection.file` or
 * `connection.values` instead.
 */
export type RegisterOptions =
  | ({
      /**
       * Your ConfigDirector Server SDK key. This is a secret value — do not commit it to source
       * control. Provide it via an environment variable (e.g. process.env.CONFIGDIRECTOR_SERVER_KEY).
       */
      serverSdkKey: string;
    } & ConfigDirectorClientOptions)
  | (OfflineClientOptions & { serverSdkKey?: undefined });

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
 *
 * In `offline` mode no key is needed, and the server never connects:
 *
 * ```ts
 * await register({ connection: { mode: "offline", file: "./flags/new-checkout-on.json" } });
 * ```
 *
 * Rejects with a `ConfigDirectorInitializationError` when the key is missing outside `offline`
 * mode, or when the offline file or values cannot be loaded.
 */
export async function register(options: RegisterOptions): Promise<void> {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") {
    return;
  }

  const connectionMode = options.connection?.mode ?? "streaming";
  if (connectionMode !== "offline" && !options.serverSdkKey) {
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
    globalThis.__configDirectorServerConnectionMode = connectionMode;
    const client = new DefaultConfigDirectorClient(
      serverSdkKey,
      { sdkName: "nextjs-sdk", sdkVersion: "__VERSION__" },
      clientOptions,
    );
    globalThis.__configDirectorServerClient = client;
    try {
      await client.initialize();
    } catch (error) {
      globalThis.__configDirectorServerClient = undefined;
      globalThis.__configDirectorServerConnectionMode = undefined;
      globalThis.__configDirectorAppMeta = undefined;
      client.dispose();
      throw error;
    }
  }
}

export function getAppMeta(): { appName?: string; appVersion?: string } {
  return globalThis.__configDirectorAppMeta ?? {};
}

export function getServerConnectionMode(): ConnectionMode | undefined {
  return globalThis.__configDirectorServerConnectionMode;
}

export function getConfigClient(): ConfigDirectorClient {
  if (!globalThis.__configDirectorServerClient) {
    throw new ConfigDirectorInitializationError(
      "[ConfigDirector] Server client not initialized. Make sure to call register() in your instrumentation.ts file before using the SDK.",
    );
  }
  return globalThis.__configDirectorServerClient;
}
