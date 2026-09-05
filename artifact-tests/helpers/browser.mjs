import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";

const HTML = [
  "<!doctype html>",
  '<html><head><meta charset="utf-8"></head>',
  '<body><div id="app"></div><script type="module" src="./app.js"></script></body></html>',
].join("");

export const runBrowserSmoke = async ({ project, server, entry, define = {} }) => {
  const webDir = join(project.dir, "web");
  await mkdir(webDir, { recursive: true });
  await build({
    absWorkingDir: project.dir,
    entryPoints: [join(project.dir, entry)],
    bundle: true,
    format: "esm",
    outfile: join(webDir, "app.js"),
    jsx: "automatic",
    define: { __BASE_URL__: JSON.stringify(server.baseUrl), ...define },
    logLevel: "silent",
  });
  await writeFile(join(webDir, "index.html"), HTML);
  server.serveStatic(webDir);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const messages = [];
    page.on("console", (message) => messages.push(`[${message.type()}] ${message.text()}`));
    page.on("pageerror", (error) => messages.push(`[pageerror] ${error.message}`));
    await page.goto(`${server.baseUrl}/app/index.html`);
    try {
      await page.waitForFunction(() => window.__SMOKE__ !== undefined, undefined, { timeout: 30_000 });
    } catch {
      throw new Error(`The page reported no smoke result within 30s.\n${messages.join("\n")}`);
    }
    return await page.evaluate(() => window.__SMOKE__);
  } finally {
    await browser.close();
  }
};
