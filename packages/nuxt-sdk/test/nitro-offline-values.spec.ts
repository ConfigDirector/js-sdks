import { describe, test, expect, vi, beforeEach } from "vitest";
import type { NitroApp } from "nitropack";
import type { H3Event } from "h3";
import offlineValuesHandler from "../src/runtime/nitro/offline-values";

const { nitroApp } = vi.hoisted(() => ({
  nitroApp: {} as { configDirectorClient: unknown; configDirectorConnectionMode: string },
}));

vi.mock("nitropack/runtime", () => ({
  useNitroApp: () => nitroApp as unknown as NitroApp,
}));

vi.mock("h3", async (importOriginal) => ({
  ...(await importOriginal<typeof import("h3")>()),
  defineEventHandler: (handler: unknown) => handler,
}));

const offlineConfigStates = {
  "new-checkout": { id: "offline:new-checkout", key: "new-checkout", type: "boolean", value: "true" },
  "max-items": { id: "offline:max-items", key: "max-items", type: "integer", value: "20" },
  "discount-rate": { id: "offline:discount-rate", key: "discount-rate", type: "float", value: "0.25" },
  "greeting": { id: "offline:greeting", key: "greeting", type: "string", value: "hello" },
  "theme": { id: "offline:theme", key: "theme", type: "json", value: JSON.stringify({ color: "blue" }) },
};

const runHandler = () =>
  (offlineValuesHandler as unknown as (event: H3Event) => unknown)({ context: {} } as unknown as H3Event);

describe("ConfigDirector offline values route", () => {
  beforeEach(() => {
    nitroApp.configDirectorClient = { getAllConfigs: () => offlineConfigStates };
  });

  test("returns every offline key decoded by config type when the server half is offline", () => {
    nitroApp.configDirectorConnectionMode = "offline";

    expect(runHandler()).toEqual({
      "new-checkout": true,
      "max-items": 20,
      "discount-rate": 0.25,
      "greeting": "hello",
      "theme": { color: "blue" },
    });
  });

  test("is not found when the server half is live", () => {
    nitroApp.configDirectorConnectionMode = "streaming";

    expect(() => runHandler()).toThrow(expect.objectContaining({ statusCode: 404 }));
  });
});
