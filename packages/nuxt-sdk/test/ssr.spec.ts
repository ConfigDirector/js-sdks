import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { setup, $fetch } from "@nuxt/test-utils/e2e";

const FIXTURE_DIR = fileURLToPath(
  new URL("./fixtures/configdirector", import.meta.url),
);

describe("ConfigDirector Nuxt SDK — SSR and server composables", async () => {
  await setup({ rootDir: FIXTURE_DIR });

  describe("SSR composables (useConfigDirectorValue, useConfigDirectorStatus)", () => {
    it("renders the string config value fetched from the backend during SSR", async () => {
      const html = await $fetch("/");
      expect(html).toContain("Hello from ConfigDirector!");
    });

    it("renders the boolean config value during SSR", async () => {
      const html = await $fetch("/");
      const match = html.match(
        /data-testid="feature-enabled"[^>]*>([^<]*)<\/div>/,
      );
      expect(match?.[1]?.trim()).toBe("true");
    });

    it("renders the integer config value during SSR", async () => {
      const html = await $fetch("/");
      const match = html.match(/data-testid="item-count"[^>]*>([^<]*)<\/div>/);
      expect(match?.[1]?.trim()).toBe("7");
    });

    it("reflects a non-loading ready status in the SSR output", async () => {
      const html = await $fetch("/");
      const match = html.match(/data-testid="status"[^>]*>([^<]*)<\/div>/);
      const status = match?.[1]?.trim();
      expect(status).toBe("ready");
    });

    it("renders the loading indicator as 'done' in SSR (SSR is synchronous — never loading)", async () => {
      const html = await $fetch("/");
      const match = html.match(/data-testid="loading"[^>]*>([^<]*)<\/div>/);
      expect(match?.[1]?.trim()).toBe("done");
    });
  });

  describe("Server composable (useConfigDirectorClient) in a Nitro event handler", () => {
    it("returns config values from the server SDK client", async () => {
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

    it("reports the client as ready after it connected to the mock backend", async () => {
      const data = await $fetch<{ isReady: boolean }>("/api/config");
      expect(data.isReady).toBe(true);
    });

    it("returns the default value for an unknown config key", async () => {
      const data = await $fetch<{ nonExistentKey: string }>("/api/config");
      expect(data.nonExistentKey).toBe("default-value");
    });
  });
});
