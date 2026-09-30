import { INSTALLED_TEST_CLIENT_SLOT, type InstalledTestClientSlot } from "../installedTestClient";
import type { TestClient } from "./TestClient";

/**
 * Makes every `ConfigDirectorProvider` mounted without a `client` prop, and every client
 * `withProvider` would build, use `testClient.client` instead of building a client, until the
 * returned function uninstalls it. Construction props such as `sdkKey` are ignored while installed;
 * `context` and `hooks` apply to the installed client as they do for a `client` prop. A provider
 * reads the installed client when it is constructed, so install before rendering.
 *
 * Installing again replaces the installed test client. Each uninstall function restores the test
 * client that was installed when it was created, so nested installs are uninstalled in reverse order.
 *
 * @param testClient The test client whose `client` providers should use
 * @returns A function that uninstalls it
 *
 * @example
 * let uninstallTestClient: () => void;
 * beforeEach(() => {
 *   testClient = createTestClient({ values: { "new-checkout": true } });
 *   uninstallTestClient = installTestClient(testClient);
 * });
 * afterEach(() => uninstallTestClient());
 */
export const installTestClient = (testClient: TestClient): (() => void) => {
  const slot = globalThis as InstalledTestClientSlot;
  const previous = slot[INSTALLED_TEST_CLIENT_SLOT];
  slot[INSTALLED_TEST_CLIENT_SLOT] = testClient.client;
  return () => {
    slot[INSTALLED_TEST_CLIENT_SLOT] = previous;
  };
};
