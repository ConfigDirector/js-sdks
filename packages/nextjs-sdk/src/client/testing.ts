"use client";

import { createTestClient as createCoreTestClient } from "@js-client-core/testing/index";
import type { TestClient, TestClientOptions } from "@js-client-core/testing/index";

export { installTestClient } from "@js-client-core/testing/index";
export type { TestClient, TestClientOptions, TestValue, TestValues, TestJsonValue } from "@js-client-core/testing/index";
export { ConfigDirectorConnectionError, ConfigDirectorValidationError } from "@shared/errors";

/**
 * Creates a {@link TestClient}: a real browser `ConfigDirectorClient` connected to an in-memory
 * server that the test controls. No network connection is opened and no telemetry is sent. Render
 * the client `ConfigDirectorProvider` with `client={testClient.client}`, or install it with
 * `installTestClient` for components that render their own provider.
 *
 * @param options {@link TestClientOptions}: the initial values, the client's timeout, and its logger
 * @returns A {@link TestClient} whose `client` is passed to the code under test
 *
 * @example
 * import { createTestClient } from "@configdirector/nextjs-sdk/client/testing";
 *
 * const testClient = createTestClient({ values: { "new-checkout": true } });
 * render(
 *   <ConfigDirectorProvider client={testClient.client}>
 *     <Checkout />
 *   </ConfigDirectorProvider>,
 * );
 * act(() => testClient.setValue("new-checkout", false));
 */
export const createTestClient = (options?: TestClientOptions): TestClient => {
  return createCoreTestClient({ sdkName: "nextjs-sdk", sdkVersion: "__VERSION__" }, options);
};
