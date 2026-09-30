import { createTestClient as createCoreTestClient } from "@js-client-core/testing/index";
import type { TestClient, TestClientOptions } from "@js-client-core/testing/index";

export type { TestClient, TestClientOptions, TestValue, TestValues, TestJsonValue } from "@js-client-core/testing/index";
export { ConfigDirectorConnectionError, ConfigDirectorValidationError } from "@shared/errors";

/**
 * Creates a {@link TestClient}: a real `ConfigDirectorClient` connected to an in-memory server
 * that the test controls. No network connection is opened and no telemetry is sent. Install it with
 * `app.use(ConfigDirectorPlugin, testClient.client)`.
 *
 * @param options {@link TestClientOptions}: the initial values, the client's timeout, and its logger
 * @returns A {@link TestClient} whose `client` is passed to the code under test
 *
 * @example
 * import { createTestClient } from "@configdirector/vue-sdk/testing";
 *
 * const testClient = createTestClient({ values: { "new-checkout": true } });
 * render(Checkout, { global: { plugins: [[ConfigDirectorPlugin, testClient.client]] } });
 * testClient.setValue("new-checkout", false);
 * await nextTick();
 */
export const createTestClient = (options?: TestClientOptions): TestClient => {
  return createCoreTestClient({ sdkName: "vue-sdk", sdkVersion: "__VERSION__" }, options);
};
