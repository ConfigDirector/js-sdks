import type { ConfigDirectorClient } from "@configdirector/server-sdk";

// In Nitro, useConfigDirectorClient() returns the server SDK's client. `nuxt typecheck` also checks
// this route with the app's auto-imports, for the typed $fetch("/api/configs"), and there the same
// name is the app composable that returns { client }, hence the cast.
export default defineEventHandler((event) =>
  resolveConfigs(useConfigDirectorClient() as unknown as ConfigDirectorClient, getRequestURL(event).searchParams),
);
