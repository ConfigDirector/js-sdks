import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ConfigDirectorContext } from "@configdirector/server-sdk";
import { createTestClient } from "@configdirector/server-sdk/testing";
import type { TestClient } from "@configdirector/server-sdk/testing";
import { resolveConfigs } from "../../server/utils/configs";

// The Nitro plugin of the Nuxt SDK runs the server SDK's client, so the server SDK's test client
// stands in for the client that useConfigDirectorServerClient() returns in GET /api/configs.

const SAMPLE_VALUES = {
  "temporary-feature-flag": false,
  "permanent-kill-switch": true,
  "integer-config": 42,
  "day-of-the-week-config": "Monday",
  "json-value-config": { theme: "dark" },
};

describe("GET /api/configs", () => {
  let testClient: TestClient;

  beforeEach(async () => {
    testClient = createTestClient({ values: SAMPLE_VALUES });
    await testClient.client.initialize();
  });

  afterEach(async () => {
    await testClient.client.dispose();
  });

  const get = (query = "") => resolveConfigs(testClient.client, new URLSearchParams(query));

  const evaluatedContexts = () => {
    const contexts: (ConfigDirectorContext | undefined)[] = [];
    testClient.client.on("configEvaluated", ({ evaluation }) => contexts.push(evaluation.context));
    return contexts;
  };

  test("serves every config value from the server client", () => {
    expect(get()).toStrictEqual(SAMPLE_VALUES);
  });

  test("serves a changed value on the next request", () => {
    testClient.setValue("permanent-kill-switch", false);
    testClient.setValue("integer-config", 7);

    expect(get()).toMatchObject({ "permanent-kill-switch": false, "integer-config": 7 });
  });

  test("serves the in-code default values when the configs are missing", () => {
    testClient.replaceValues({});

    expect(get()).toStrictEqual({
      "temporary-feature-flag": true,
      "permanent-kill-switch": false,
      "integer-config": 10,
      "day-of-the-week-config": "Friday",
      "json-value-config": {},
    });
  });

  test("evaluates every config with the query params as the context", async () => {
    const contexts = evaluatedContexts();

    get("id=user-123&kind=user&name=Ada&anonymous=false&role=admin");

    await vi.waitFor(() => expect(contexts).toHaveLength(5));
    expect(contexts).toStrictEqual(
      Array(5).fill({ id: "user-123", kind: "user", name: "Ada", anonymous: false, traits: { role: "admin" } }),
    );
  });

  test("evaluates without a context when the query has no params", async () => {
    const contexts = evaluatedContexts();

    get();

    await vi.waitFor(() => expect(contexts).toHaveLength(5));
    expect(contexts).toStrictEqual(Array(5).fill(undefined));
  });
});
