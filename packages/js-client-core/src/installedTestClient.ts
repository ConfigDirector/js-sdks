import type { ConfigDirectorClient } from "./types";

export const INSTALLED_TEST_CLIENT_SLOT = Symbol.for("@configdirector/installed-test-client");

export type InstalledTestClientSlot = { [INSTALLED_TEST_CLIENT_SLOT]?: ConfigDirectorClient };

export const readInstalledTestClient = (): ConfigDirectorClient | undefined =>
  (globalThis as InstalledTestClientSlot)[INSTALLED_TEST_CLIENT_SLOT];
