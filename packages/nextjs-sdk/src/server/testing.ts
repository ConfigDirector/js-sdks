import { createTestClient as createServerTestClient } from "@js-server-sdk/testing/TestClient";
import type { TestClient, TestClientOptions } from "@js-server-sdk/testing/TestClient";

export type { TestClient, TestClientOptions } from "@js-server-sdk/testing/TestClient";
export type { TestValue, TestValues, TestJsonValue } from "@js-server-sdk/testing/values";
export { ConfigDirectorConnectionError, ConfigDirectorValidationError } from "@shared/errors";

/**
 * Creates a {@link TestClient}: a real server `ConfigDirectorClient` connected to an in-memory
 * server that the test controls. No network connection is opened and no telemetry is sent. Put it
 * where `register()` would put the server singleton with {@link installServerTestClient}.
 *
 * @param options {@link TestClientOptions}: the initial values, the client's timeout, and its logger
 * @returns A {@link TestClient} whose `client` is passed to the code under test
 *
 * @example
 * import { createTestClient, installServerTestClient } from "@configdirector/nextjs-sdk/server/testing";
 *
 * const testClient = createTestClient({ values: { "new-checkout": true } });
 * const uninstall = installServerTestClient(testClient);
 * await testClient.client.initialize();
 */
export const createTestClient = (options?: TestClientOptions): TestClient => {
  return createServerTestClient({ sdkName: "nextjs-sdk", sdkVersion: "__VERSION__" }, options);
};

/**
 * Puts `testClient.client` where `register()` puts the server singleton, so `getConfigClient()`,
 * `generateSsrConfigSet()`, and the server `ConfigDirectorProvider` serve its values. It does not
 * initialize the client: call `await testClient.client.initialize()`, as `register()` would.
 *
 * @param testClient The server test client whose `client` to install
 * @returns A function that restores the client installed before
 */
export const installServerTestClient = (testClient: TestClient): (() => void) => {
  const previous = globalThis.__configDirectorServerClient;
  globalThis.__configDirectorServerClient = testClient.client;
  return () => {
    globalThis.__configDirectorServerClient = previous;
  };
};
