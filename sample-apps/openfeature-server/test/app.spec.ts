import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { OpenFeature, TypedInMemoryProvider } from "@openfeature/server-sdk";
import type { EvaluationContext } from "@openfeature/server-sdk";
import { createConfigsServer } from "../src/app.ts";

const sampleFlags = (values: { killSwitch: boolean; integer: number }) =>
  ({
    "temporary-feature-flag": {
      variants: { configured: false },
      defaultVariant: "configured",
      disabled: false,
    },
    "permanent-kill-switch": {
      variants: { configured: values.killSwitch },
      defaultVariant: "configured",
      disabled: false,
    },
    "integer-config": {
      variants: { configured: values.integer },
      defaultVariant: "configured",
      disabled: false,
    },
    "day-of-the-week-config": {
      variants: { configured: "Monday" },
      defaultVariant: "configured",
      disabled: false,
    },
    "json-value-config": {
      variants: { configured: { theme: "dark" } },
      defaultVariant: "configured",
      disabled: false,
    },
  }) as const;

const SAMPLE_FLAGS = sampleFlags({ killSwitch: true, integer: 42 });

describe("GET /configs", () => {
  let provider: TypedInMemoryProvider;
  let server: Server;

  beforeEach(async () => {
    provider = new TypedInMemoryProvider(SAMPLE_FLAGS);
    await OpenFeature.setProviderAndWait(provider);
    server = createConfigsServer(OpenFeature.getClient());
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  });

  afterEach(async () => {
    await new Promise((resolve) => server.close(resolve));
    await OpenFeature.clearProviders();
  });

  const get = (path: string) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`);

  test("serves every flag value from the provider", async () => {
    const response = await get("/configs");

    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      "temporary-feature-flag": false,
      "permanent-kill-switch": true,
      "integer-config": 42,
      "day-of-the-week-config": "Monday",
      "json-value-config": { theme: "dark" },
    });
  });

  test("serves the in-code default values for flags the provider does not know", async () => {
    await OpenFeature.setProviderAndWait(new TypedInMemoryProvider({}));

    const response = await get("/configs");

    expect(await response.json()).toStrictEqual({
      "temporary-feature-flag": true,
      "permanent-kill-switch": false,
      "integer-config": 10,
      "day-of-the-week-config": "Friday",
      "json-value-config": {},
    });
  });

  test("serves a changed configuration on the next request", async () => {
    await provider.putConfiguration(sampleFlags({ killSwitch: false, integer: 7 }));

    const response = await get("/configs");

    expect(await response.json()).toMatchObject({ "permanent-kill-switch": false, "integer-config": 7 });
  });

  test("evaluates with the query string as the evaluation context", async () => {
    const contexts: EvaluationContext[] = [];
    await provider.putConfiguration({
      ...SAMPLE_FLAGS,
      "day-of-the-week-config": {
        variants: { weekday: "Monday", weekend: "Saturday" },
        defaultVariant: "weekday",
        disabled: false,
        contextEvaluator: (context: EvaluationContext) => {
          contexts.push(context);
          return context.targetingKey === "user-123" ? "weekend" : "weekday";
        },
      },
    });

    const response = await get("/configs?targetingKey=user-123&name=Ada&anonymous=false&role=admin");

    expect(await response.json()).toMatchObject({ "day-of-the-week-config": "Saturday" });
    expect(contexts).toStrictEqual([
      { targetingKey: "user-123", name: "Ada", anonymous: false, traits: { role: "admin" } },
    ]);
  });

  test("takes the targeting key from the id parameter too", async () => {
    const contexts: EvaluationContext[] = [];
    await provider.putConfiguration({
      ...SAMPLE_FLAGS,
      "day-of-the-week-config": {
        variants: { weekday: "Monday" },
        defaultVariant: "weekday",
        disabled: false,
        contextEvaluator: (context: EvaluationContext) => {
          contexts.push(context);
          return "weekday";
        },
      },
    });

    await get("/configs?id=user-456");

    expect(contexts).toStrictEqual([{ targetingKey: "user-456" }]);
  });

  test("answers 404 for any other path", async () => {
    const response = await get("/flags");

    expect(response.status).toBe(404);
  });
});
