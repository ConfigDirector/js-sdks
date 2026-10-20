import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { register, getConfigClient, ConfigDirectorInitializationError } from "../src/server";

const writeValuesFile = async (contents: string): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), "configdirector-nextjs-offline-"));
  const file = join(directory, "values.json");
  await writeFile(file, contents);
  return relative(process.cwd(), file);
};

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

describe("register() in offline mode", () => {
  const previousRuntime = process.env["NEXT_RUNTIME"];

  beforeEach(() => {
    process.env["NEXT_RUNTIME"] = "nodejs";
  });

  afterEach(() => {
    process.env["NEXT_RUNTIME"] = previousRuntime;
    globalThis.__configDirectorServerClient?.dispose();
    globalThis.__configDirectorServerClient = undefined;
    globalThis.__configDirectorServerConnectionMode = undefined;
    globalThis.__configDirectorAppMeta = undefined;
    vi.restoreAllMocks();
  });

  test("starts the server singleton from a values file without a server SDK key and without a request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const file = await writeValuesFile(
      JSON.stringify({ "new-checkout": true, "max-items": 20, ratio: 2.5, greeting: "hello", theme: { color: "blue" } }),
    );

    await register({ connection: { mode: "offline", file } });

    const client = getConfigClient();
    expect(client.isReady).toBe(true);
    expect(client.getValue("new-checkout", false, { id: "user-a" })).toBe(true);
    expect(client.getValue("max-items", 0)).toBe(20);
    expect(client.getValue("ratio", 0)).toBe(2.5);
    expect(client.getValue("greeting", "")).toBe("hello");
    expect(client.getValue("theme", {})).toEqual({ color: "blue" });
    await sleep(10);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("rejects with ConfigDirectorInitializationError when the values file is missing and installs no singleton", async () => {
    const rejection = await register({ connection: { mode: "offline", file: "./flags/missing-cell.json" } }).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(rejection).toBeInstanceOf(ConfigDirectorInitializationError);
    expect((rejection as Error).message).toContain("./flags/missing-cell.json");
    expect(() => getConfigClient()).toThrow("not initialized");
  });

  test("rejects a missing server SDK key outside offline mode", async () => {
    await expect(register({ serverSdkKey: "", connection: { mode: "streaming" } })).rejects.toThrow(
      "The ConfigDirector serverSdkKey must be provided to register()",
    );
    expect(() => getConfigClient()).toThrow("not initialized");
  });
});
