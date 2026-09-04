import { fileURLToPath } from "node:url";
import { describe, test, expect } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils/e2e";

const FIXTURE_DIR = fileURLToPath(new URL("./fixtures/configdirector", import.meta.url));

describe("ConfigDirector Nuxt SDK — SSR and server composables", async () => {
  await setup({ rootDir: FIXTURE_DIR });

  describe("SSR composables (useConfigDirectorValue, useConfigDirectorStatus)", () => {
    test("renders the string config value fetched from the backend during SSR", async () => {
      const html = await $fetch("/");
      expect(html).toContain("Hello from ConfigDirector!");
    });

    test("renders the boolean config value during SSR", async () => {
      const html = await $fetch("/");
      const match = html.match(/data-testid="feature-enabled"[^>]*>([^<]*)<\/div>/);
      expect(match?.[1]?.trim()).toBe("true");
    });

    test("renders the integer config value during SSR", async () => {
      const html = await $fetch("/");
      const match = html.match(/data-testid="item-count"[^>]*>([^<]*)<\/div>/);
      expect(match?.[1]?.trim()).toBe("7");
    });

    test("reflects a non-loading ready status in the SSR output", async () => {
      const html = await $fetch("/");
      const match = html.match(/data-testid="status"[^>]*>([^<]*)<\/div>/);
      const status = match?.[1]?.trim();
      expect(status).toBe("ready");
    });

    test("renders the loading indicator as 'done' in SSR (SSR is synchronous — never loading)", async () => {
      const html = await $fetch("/");
      const match = html.match(/data-testid="loading"[^>]*>([^<]*)<\/div>/);
      expect(match?.[1]?.trim()).toBe("done");
    });

    test("renders the json config value as a parsed object in SSR HTML", async () => {
      const html = await $fetch("/");
      const match = html.match(/data-testid="json-data"[^>]*>([^<]*)<\/div>/);
      const decoded = match?.[1]?.trim().replace(/&quot;/g, '"');
      expect(decoded).toBe(JSON.stringify({ greeting: "hello", count: 3 }));
    });

    test("does not accumulate watch handlers on the shared server client across SSR renders", async () => {
      await $fetch("/");
      await $fetch("/");
      await $fetch("/");

      const { count } = await $fetch<{ count: number }>("/api/watch-handlers");
      expect(count).toBe(0);
    });
  });

  describe("Server composable (useConfigDirectorClient) in a Nitro event handler", () => {
    test("returns config values from the server SDK client", async () => {
      const data = await $fetch<{
        welcomeMessage: string;
        featureEnabled: boolean;
        itemCount: number;
        isReady: boolean;
      }>("/api/config");

      expect(data.welcomeMessage).toBe("Hello from ConfigDirector!");
      expect(data.featureEnabled).toBe(true);
      expect(data.itemCount).toBe(7);
    });

    test("reports the client as ready after it connected to the mock backend", async () => {
      const data = await $fetch<{ isReady: boolean }>("/api/config");
      expect(data.isReady).toBe(true);
    });

    test("returns the default value for an unknown config key", async () => {
      const data = await $fetch<{ nonExistentKey: string }>("/api/config");
      expect(data.nonExistentKey).toBe("default-value");
    });

    test("returns the json config value as a parsed object", async () => {
      const data = await $fetch<{ jsonData: object }>("/api/config");
      expect(data.jsonData).toEqual({ greeting: "hello", count: 3 });
    });

    test("returns the raw json string when the default value type is string", async () => {
      const data = await $fetch<{ jsonDataRaw: string }>("/api/config");
      expect(data.jsonDataRaw).toBe(JSON.stringify({ greeting: "hello" }));
    });

    test("returns the default object when the json config key is not in the server bundle", async () => {
      const data = await $fetch<{ jsonDataFallback: object }>("/api/config");
      expect(data.jsonDataFallback).toEqual({ label: "default" });
    });
  });

  describe("Server composable (useConfigDirectorServerHooks) in a Nitro plugin", () => {
    test("calls the clientReady hook after the Nitro client connects to the backend", async () => {
      const data = await $fetch<{ clientReady: number; configsUpdated: number }>("/api/hook-calls");
      expect(data.clientReady).toBeGreaterThan(0);
    });

    test("calls the configsUpdated hook after the Nitro client receives the initial config bundle", async () => {
      const data = await $fetch<{ clientReady: number; configsUpdated: number }>("/api/hook-calls");
      expect(data.configsUpdated).toBeGreaterThan(0);
    });
  });
});
