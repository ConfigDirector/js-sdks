import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Rollup/tsdown plugin that replaces:
 *
 *   new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
 *
 * with an inline blob-URL worker containing the fully-bundled worker code:
 *
 *   new Worker(URL.createObjectURL(new Blob([<code>], { type: "application/javascript" })))
 *
 * This makes the Worker self-contained in the distributed SDK bundle — no separate
 * worker file needs to be served by the consumer alongside the SDK.
 *
 */
export function inlineWorkerPlugin() {
  /** @type {Map<string, Promise<string>>} keyed by resolved worker absolute path */
  const buildPromises = new Map();

  return {
    name: "inline-worker",

    /** @param {string} code @param {string} id */
    async transform(code, id) {
      if (!code.includes("new Worker") || !code.includes("import.meta.url")) {
        return null;
      }

      // Matches: new Worker(new URL("./path", import.meta.url), { ... })
      const PATTERN =
        /new Worker\(\s*new URL\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)\s*,\s*\{[^}]+\}\s*\)/;
      const match = PATTERN.exec(code);
      if (!match) return null;

      const [fullMatch, workerRelPath] = match;

      // Strip any query params that bundlers may append to the id
      const idPath = id.includes("?") ? id.slice(0, id.indexOf("?")) : id;
      let workerAbsPath = path.resolve(path.dirname(idPath), workerRelPath);
      if (!path.extname(workerAbsPath)) {
        workerAbsPath += ".ts";
      }

      if (!fs.existsSync(workerAbsPath)) {
        this.warn(`[inline-worker] Worker source not found: ${workerAbsPath}`);
        return null;
      }

      // Deduplicate concurrent builds across format variants (ESM + CJS run in parallel)
      if (!buildPromises.has(workerAbsPath)) {
        buildPromises.set(workerAbsPath, bundleWorker(workerAbsPath));
      }
      const workerCode = await buildPromises.get(workerAbsPath);

      const replacement = `new Worker(URL.createObjectURL(new Blob([${JSON.stringify(workerCode)}], { type: "application/javascript" })))`;

      return {
        code: code.slice(0, match.index) + replacement + code.slice(match.index + fullMatch.length),
        map: null,
      };
    },
  };
}

/**
 * Bundles a worker TypeScript source file and all its dependencies into a
 * self-contained IIFE string using rolldown directly.
 *
 * We use rolldown (the underlying bundler that tsdown wraps) rather than tsdown
 * itself to avoid tsdown scanning upward for a tsdown.config.js and merging
 * its entries with ours, which would break IIFE's single-entry requirement.
 * rolldown rc.12+ includes native TypeScript support via oxc, so no extra plugin
 * is needed.
 *
 * @param {string} workerAbsPath  Absolute path to the worker .ts entry file.
 * @returns {Promise<string>}     The bundled IIFE code as a string.
 */
async function bundleWorker(workerAbsPath) {
  const pkgRoot = findPackageRoot(workerAbsPath);
  const tsconfig = path.join(pkgRoot, "tsconfig.json");
  const alias = tsconfigPathsToAliases(tsconfig, pkgRoot);

  const { rolldown } = await import("rolldown");

  const bundle = await rolldown({
    input: workerAbsPath,
    resolve: { alias },
  });

  const result = await bundle.generate({
    format: "iife",
    codeSplitting: false,
    minify: true,
  });

  const chunk = result.output.find((o) => "code" in o);
  if (!chunk) {
    throw new Error("[inline-worker] rolldown produced no JS chunk for the worker");
  }
  return chunk.code;
}

/**
 * Reads a tsconfig.json and converts its `compilerOptions.paths` entries into
 * a rolldown-compatible alias map.
 *
 * e.g. { "@shared/*": ["../shared/src/*"] } → { "@shared": "/abs/path/to/shared/src" }
 *
 * @param {string} tsconfig  Absolute path to tsconfig.json.
 * @param {string} pkgRoot   Absolute path to the package root (where tsconfig lives).
 * @returns {Record<string, string>}
 */
function tsconfigPathsToAliases(tsconfig, pkgRoot) {
  if (!fs.existsSync(tsconfig)) return {};
  const config = parseJsonc(fs.readFileSync(tsconfig, "utf-8"));
  const paths = config.compilerOptions?.paths ?? {};
  /** @type {Record<string, string>} */
  const alias = {};
  for (const [key, [first]] of Object.entries(paths)) {
    alias[key.replace(/\/\*$/, "")] = path.resolve(pkgRoot, first.replace(/\/\*$/, ""));
  }
  return alias;
}

/**
 * Parses a JSONC string (JSON with comments and trailing commas), as used by tsconfig files.
 * @param {string} text
 */
function parseJsonc(text) {
  const stripped = text
    .replace(/\/\/[^\n]*/g, "")         // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, "")   // multi-line comments
    .replace(/,(\s*[}\]])/g, "$1");      // trailing commas
  return JSON.parse(stripped);
}

/**
 * Walks up the directory tree to find the nearest package.json root.
 * @param {string} filePath
 * @returns {string}
 */
function findPackageRoot(filePath) {
  let dir = path.dirname(filePath);
  const { root } = path.parse(dir);
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error(`[inline-worker] No package.json found above: ${filePath}`);
}
