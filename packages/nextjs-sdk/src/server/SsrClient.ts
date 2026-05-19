import type { ConfigDirectorContext, ConfigValueType, WatchHandler } from "@js-server-sdk/types";
import { getServerSingleton } from "./singleton";

/**
 * A thin wrapper around the server SDK singleton that binds a per-request user context to every
 * evaluation, making it behave like the browser client (no context arg on getValue/watch) from
 * the perspective of calling code.
 *
 * Create one per request via {@link createSsrClient}. The underlying server SDK singleton is
 * shared and long-lived; the SsrClient is lightweight and request-scoped.
 */
export class SsrClient {
  constructor(private readonly context: ConfigDirectorContext | undefined) {}

  get isReady(): boolean {
    return getServerSingleton().isReady;
  }

  getValue<T extends ConfigValueType>(configKey: string, defaultValue: T): T {
    return getServerSingleton().getValue(configKey, defaultValue, this.context);
  }

  /**
   * Synchronously evaluates the config and calls the callback once, then returns a no-op unwatch.
   *
   * In a Server Component there is no component lifecycle to subscribe to, so live-watching is not
   * meaningful. Use getValue() directly in Server Components; watch() is here for symmetry with the
   * browser client interface.
   */
  watch<T extends ConfigValueType>(
    configKey: string,
    defaultValue: T,
    callback: WatchHandler<T>,
  ): () => void {
    callback(this.getValue(configKey, defaultValue));
    return () => {};
  }

  unwatch<T extends ConfigValueType>(configKey: string, callback?: WatchHandler<T>): void {
    getServerSingleton().unwatch(configKey, callback);
  }

  unwatchAll(): void {
    getServerSingleton().unwatchAll();
  }
}

/**
 * Creates a request-scoped {@link SsrClient} that evaluates configs against the shared server
 * SDK singleton using the provided user context.
 *
 * Call this in Server Components or Route Handlers:
 *
 * ```ts
 * // app/dashboard/page.tsx (Server Component)
 * import { createSsrClient } from "@configdirector/nextjs-sdk/server";
 * import { cookies } from "next/headers";
 *
 * export default async function DashboardPage() {
 *   const userId = (await cookies()).get("userId")?.value;
 *   const client = createSsrClient({ userId });
 *   const showNewDashboard = client.getValue("new-dashboard", false);
 *   // ...
 * }
 * ```
 */
export function createSsrClient(context?: ConfigDirectorContext): SsrClient {
  return new SsrClient(context);
}
