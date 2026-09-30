import { createTestClient as createInMemoryTestClient } from "./testing/TestClient";
import type { TestClient, TestClientOptions } from "./testing/TestClient";

export type { TestClient, TestClientOptions } from "./testing/TestClient";
export type { TestValue, TestValues, TestJsonValue } from "./testing/values";
export { ConfigDirectorConnectionError, ConfigDirectorValidationError } from "@shared/errors";

/**
 * Creates a {@link TestClient}: a real `ConfigDirectorClient` connected to an in-memory server
 * that the test controls. No network connection is opened and no telemetry is sent.
 *
 * @param options {@link TestClientOptions}: the initial values, the client's timeout, and its logger
 * @returns A {@link TestClient} whose `client` is passed to the code under test
 *
 * @example
 * import { createTestClient } from "@configdirector/server-sdk/testing";
 *
 * const testClient = createTestClient({ values: { "new-checkout": true } });
 * await testClient.client.initialize();
 * expect(testClient.client.getValue("new-checkout", false)).toBe(true);
 *
 * testClient.setValue("new-checkout", false);
 */
export const createTestClient = (options?: TestClientOptions): TestClient => {
  return createInMemoryTestClient({ sdkName: "js-server-sdk", sdkVersion: "__VERSION__" }, options);
};
