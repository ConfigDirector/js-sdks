import { describe, test, expect, vi, beforeEach } from "vitest";
import type { Nuxt } from "@nuxt/schema";
import module from "../src/module";

const { addImports, addServerImports } = vi.hoisted(() => ({
  addImports: vi.fn(),
  addServerImports: vi.fn(),
}));

vi.mock("@nuxt/kit", () => ({
  defineNuxtModule: (definition: unknown) => definition,
  createResolver: () => ({ resolve: (path: string) => path }),
  useLogger: () => ({ debug: () => {} }),
  addPlugin: vi.fn(),
  addServerPlugin: vi.fn(),
  addServerHandler: vi.fn(),
  addImports,
  addServerImports,
}));

const runSetup = (): void => {
  const nuxt = { options: { runtimeConfig: { public: {} } } } as unknown as Nuxt;
  (module as unknown as { setup: (options: object, nuxt: Nuxt) => void }).setup({}, nuxt);
};

type AutoImport = { name: string; as?: string };

const registeredNames = (register: ReturnType<typeof vi.fn>): string[] =>
  register.mock.calls.flatMap(([imports]) => (imports as AutoImport[]).map((i) => i.as ?? i.name));

describe("ConfigDirector Nuxt module", () => {
  beforeEach(() => {
    addImports.mockReset();
    addServerImports.mockReset();
  });

  test("registers the Nitro server client composable as useConfigDirectorServerClient", () => {
    runSetup();

    expect(addServerImports).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          name: "useConfigDirectorServerClient",
          as: "useConfigDirectorServerClient",
          from: "./runtime/server/composables/useConfigDirectorServerClient",
        },
      ]),
    );
  });

  test("gives the app and Nitro auto-imports distinct names, so nuxt typecheck resolves each one", () => {
    runSetup();

    const appNames = registeredNames(addImports);
    const serverNames = registeredNames(addServerImports);
    expect(appNames).toContain("useConfigDirectorClient");
    expect(serverNames.filter((name) => appNames.includes(name))).toEqual([]);
  });
});
