import { describe, test, expect, vi, beforeEach } from "vitest";
import type { NitroApp } from "nitropack";
import type { H3Event } from "h3";
import middleware from "../src/runtime/nitro/middleware";

const { runtimeConfig, nitroApp } = vi.hoisted(() => ({
  runtimeConfig: { configdirector: {} as Record<string, unknown> },
  nitroApp: {} as { configDirectorClient: unknown; configDirectorInitialization: Promise<void> },
}));

vi.mock("nitropack/runtime", () => ({
  useNitroApp: () => nitroApp as unknown as NitroApp,
  useRuntimeConfig: () => runtimeConfig,
}));

vi.mock("h3", () => ({
  defineEventHandler: (handler: unknown) => handler,
}));

const client = { isReady: false };

const runMiddleware = (): { event: H3Event; result: unknown } => {
  const event = { context: {} } as unknown as H3Event;
  const result = (middleware as unknown as (event: H3Event) => unknown)(event);
  return { event, result };
};

describe("ConfigDirector Nitro middleware", () => {
  let releaseInitialization: () => void;

  beforeEach(() => {
    nitroApp.configDirectorClient = client;
    nitroApp.configDirectorInitialization = new Promise<void>((resolve) => {
      releaseInitialization = resolve;
    });
  });

  test("holds the request until the client initialization settles by default", async () => {
    runtimeConfig.configdirector = { waitForInitialization: true };

    const { event, result } = runMiddleware();
    await Promise.resolve();
    expect(event.context.configDirectorClient).toBeUndefined();

    releaseInitialization();
    await result;
    expect(event.context.configDirectorClient).toBe(client);
  });

  test("exposes the client without waiting when waitForInitialization is disabled", async () => {
    runtimeConfig.configdirector = { waitForInitialization: false };

    const { event, result } = runMiddleware();
    await result;

    expect(event.context.configDirectorClient).toBe(client);
  });
});
