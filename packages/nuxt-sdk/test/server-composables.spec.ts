import { describe, test, expect, vi } from "vitest";
import type { NitroApp } from "nitropack";
import { useConfigDirectorServerClient } from "../src/runtime/server/composables/useConfigDirectorServerClient";
import { useConfigDirectorServerHooks } from "../src/runtime/server/composables/useConfigDirectorServerHooks";

vi.mock("nitropack/runtime", () => ({
  useNitroApp: () => ({}) as NitroApp,
}));

describe("ConfigDirector server composables before the Nitro plugin has run", () => {
  test("useConfigDirectorServerClient throws an Error saying the Nitro plugin was not initialized", () => {
    expect(() => useConfigDirectorServerClient()).toThrow(
      new Error("The ConfigDirector Nitro plugin was not initialized"),
    );
  });

  test("useConfigDirectorServerHooks throws an Error saying the Nitro plugin was not initialized", () => {
    expect(() => useConfigDirectorServerHooks({})).toThrow(
      new Error("The ConfigDirector Nitro plugin was not initialized"),
    );
  });
});
