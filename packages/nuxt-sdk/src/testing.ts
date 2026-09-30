import { createTestClient as createCoreTestClient } from "@js-client-core/testing/index";
import type { TestClient, TestClientOptions } from "@js-client-core/testing/index";

export type { TestClient, TestClientOptions, TestValue, TestValues, TestJsonValue } from "@js-client-core/testing/index";
export { installTestClient } from "@js-client-core/testing/index";
export { ConfigDirectorConnectionError, ConfigDirectorValidationError } from "@shared/errors";

/**
 * Creates a {@link TestClient}: a real `ConfigDirectorClient` connected to an in-memory server
 * that the test controls. No network connection is opened and no telemetry is sent. Hand it to the
 * ConfigDirector Nuxt plugin with `installTestClient` before the Nuxt app is created.
 *
 * @param options {@link TestClientOptions}: the initial values, the client's timeout, and its logger
 * @returns A {@link TestClient} whose `client` the plugin provides to the app
 *
 * @example
 * import { createTestClient, installTestClient } from "@configdirector/nuxt-sdk/testing";
 *
 * const testClient = createTestClient({ values: { "new-checkout": true } });
 * installTestClient(testClient);
 *
 * test("shows the new checkout when the flag is on", async () => {
 *   const component = await mountSuspended(Checkout);
 *   expect(component.text()).toContain("New checkout");
 * });
 */
export const createTestClient = (options?: TestClientOptions): TestClient => {
  return createCoreTestClient({ sdkName: "nuxt-sdk", sdkVersion: "__VERSION__" }, options);
};
