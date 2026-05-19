import { describe, it, expect } from "vitest";

const url = (path: string) => `${process.env["NEXTJS_SDK_TEST_URL"]}${path}`;

const $fetch = async (path: string): Promise<string> => {
  const res = await fetch(url(path));
  return res.text();
};

const $fetchJson = async <T>(path: string): Promise<T> => {
  const res = await fetch(url(path));
  return res.json() as Promise<T>;
};

describe("ConfigDirector Next.js SDK — SSR and initialConfigs", () => {
  it("renders the string config value via initialConfigs in SSR HTML", async () => {
    const html = await $fetch("/");
    expect(html).toContain("Hello from ConfigDirector!");
  });

  it("renders the boolean config value in SSR HTML", async () => {
    const html = await $fetch("/");
    const match = html.match(/data-testid="feature-enabled"[^>]*>([^<]*)<\/div>/);
    expect(match?.[1]?.trim()).toBe("true");
  });

  it("renders the integer config value in SSR HTML", async () => {
    const html = await $fetch("/");
    const match = html.match(/data-testid="item-count"[^>]*>([^<]*)<\/div>/);
    expect(match?.[1]?.trim()).toBe("7");
  });

  it("reflects a 'loading' status in SSR HTML (browser client has not yet connected)", async () => {
    // Unlike Nuxt's SsrClient which delegates isReady from the server SDK, the Next.js provider
    // defers browser client creation to componentDidMount. SSR always renders 'loading'.
    const html = await $fetch("/");
    const match = html.match(/data-testid="status"[^>]*>([^<]*)<\/div>/);
    expect(match?.[1]?.trim()).toBe("loading");
  });
});

describe("ConfigDirector Next.js SDK — Route Handler (server SDK client)", () => {
  it("returns config values from the server SDK client", async () => {
    const data = await $fetchJson<{
      welcomeMessage: string;
      featureEnabled: boolean;
      itemCount: number;
      isReady: boolean;
    }>("/api/config");

    expect(data.welcomeMessage).toBe("Hello from ConfigDirector!");
    expect(data.featureEnabled).toBe(true);
    expect(data.itemCount).toBe(7);
  });

  it("reports the server SDK client as ready after connecting to the mock backend", async () => {
    const data = await $fetchJson<{ isReady: boolean }>("/api/config");
    expect(data.isReady).toBe(true);
  });

  it("returns the default value for an unknown config key", async () => {
    const data = await $fetchJson<{ nonExistentKey: string }>("/api/config");
    expect(data.nonExistentKey).toBe("default-value");
  });
});
