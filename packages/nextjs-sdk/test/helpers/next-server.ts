import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));

const FIXTURE_DIR = resolve(__dirname, "../fixtures/app");

// next may be hoisted to the workspace root or kept in this package's own node_modules
const NEXT_BIN = (() => {
  const candidates = [
    resolve(__dirname, "../../node_modules/.bin/next"),
    resolve(__dirname, "../../../../node_modules/.bin/next"),
  ];
  const found = candidates.find(existsSync);
  if (!found) throw new Error(`Could not find the 'next' binary. Searched: ${candidates.join(", ")}`);
  return found;
})();

const getFreePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });

const waitForServer = async (url: string, timeoutMs = 90_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(2_000) });
      return;
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`Next.js server at ${url} did not become available within ${timeoutMs}ms: ${lastError}`);
};

export interface NextServer {
  port: number;
  baseUrl: string;
  close(): Promise<void>;
}

export const startNextServer = async (env: Record<string, string>): Promise<NextServer> => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const proc = spawn(NEXT_BIN, ["dev", "--port", String(port), "--hostname", "127.0.0.1"], {
    cwd: FIXTURE_DIR,
    env: { ...process.env, ...env, PORT: String(port) },
    stdio: "pipe",
    shell: false,
  });

  // Surface Next.js output for debugging — controlled by NEXTJS_SDK_TEST_VERBOSE env var
  if (process.env["NEXTJS_SDK_TEST_VERBOSE"]) {
    proc.stdout?.on("data", (d: Buffer) => process.stdout.write(d));
    proc.stderr?.on("data", (d: Buffer) => process.stderr.write(d));
  }

  await waitForServer(baseUrl);

  return {
    port,
    baseUrl,
    close: () =>
      new Promise<void>((resolve) => {
        proc.on("close", resolve);
        proc.kill("SIGTERM");
      }),
  };
};
