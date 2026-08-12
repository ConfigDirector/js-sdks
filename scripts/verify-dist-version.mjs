#!/usr/bin/env node
/**
 * Verifies that the `__VERSION__` sentinel was substituted in a package's build output.
 *
 * The SDK name and version reported in telemetry come from a `__VERSION__` string literal
 * in the source, replaced at build time by @rollup/plugin-replace in each package's tsdown
 * config. No unit test can catch a missing or misplaced replace plugin: under vitest the
 * sentinel is never substituted, so the specs assert the literal `"__VERSION__"` on purpose.
 * That leaves the build output as the only place the substitution can be checked, which is
 * what this script does.
 *
 * Run from a package directory (it reads ./package.json and scans ./dist).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SENTINEL = "__VERSION__";
// Sourcemaps embed the pre-replacement source by design, so scanning them would always
// report the sentinel. Only the emitted code and metadata are meaningful here.
const TEXT_FILE = /\.(js|mjs|cjs|ts|mts|cts|json)$/;

const packageDir = process.cwd();
const pkg = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
const distDir = join(packageDir, "dist");

const listFiles = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listFiles(full) : [full];
  });

let files;
try {
  files = listFiles(distDir).filter((file) => TEXT_FILE.test(file));
} catch {
  console.error(`[verify-dist-version] ${pkg.name}: no dist/ directory — run the build first.`);
  process.exit(1);
}

const offenders = files.filter((file) => readFileSync(file, "utf8").includes(SENTINEL));
const substituted = files.some((file) => readFileSync(file, "utf8").includes(pkg.version));

if (offenders.length > 0) {
  console.error(
    `[verify-dist-version] ${pkg.name}: the ${SENTINEL} sentinel survived the build in:\n` +
      offenders.map((file) => `  - ${relative(packageDir, file)}`).join("\n") +
      `\nAdd @rollup/plugin-replace to the tsdown config block that builds these entries. ` +
      `Shipping this would report "${SENTINEL}" as the SDK version in telemetry.`,
  );
  process.exit(1);
}

if (!substituted) {
  console.error(
    `[verify-dist-version] ${pkg.name}: version "${pkg.version}" does not appear anywhere in dist/. ` +
      `The ${SENTINEL} sentinel was replaced with something unexpected, or the entry that ` +
      `carries the SDK identity was dropped from the build.`,
  );
  process.exit(1);
}

console.log(`[verify-dist-version] ${pkg.name}: version ${pkg.version} substituted in dist/.`);
