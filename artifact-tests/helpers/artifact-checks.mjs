import { existsSync, readdirSync, readFileSync } from "node:fs";
import { builtinModules, createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "vitest";

const IMPORT_PATTERN = /\b(?:from|import|require)\s*\(?\s*["'`]([^"'`\n]+)["'`]/g;
const BUILTINS = new Set(builtinModules);

const walkFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walkFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );

const collectTargets = (value, condition, ignoreConditions, out) => {
  if (typeof value === "string") {
    if (value.startsWith("./") && !ignoreConditions.includes(condition)) {
      out.push(value);
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectTargets(entry, condition, ignoreConditions, out);
    }
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      collectTargets(entry, key, ignoreConditions, out);
    }
  }
  return out;
};

export const findMissingEntryFiles = (packageDir, { ignoreConditions = [] } = {}) => {
  const packageJson = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
  const targets = [];
  collectTargets(packageJson.exports ?? {}, ".", ignoreConditions, targets);
  collectTargets(packageJson.typesVersions ?? {}, ".", ignoreConditions, targets);
  for (const field of ["main", "module", "browser", "types"]) {
    if (typeof packageJson[field] === "string") {
      targets.push(packageJson[field]);
    }
  }
  return [...new Set(targets)].filter(
    (target) => !target.includes("*") && !existsSync(join(packageDir, target)),
  );
};

export const findUnresolvableImports = (packageDir, { allow = [] } = {}) => {
  const allowed = new Set(allow);
  const problems = [];
  const distDir = join(packageDir, "dist");
  const files = walkFiles(distDir).filter((file) => /\.(mjs|cjs|js)$/.test(file));
  for (const file of files) {
    const requireFrom = createRequire(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      if (
        specifier.startsWith(".") ||
        specifier.startsWith("/") ||
        specifier.startsWith("node:") ||
        BUILTINS.has(specifier) ||
        allowed.has(specifier) ||
        /[\s\\]/.test(specifier)
      ) {
        continue;
      }
      try {
        requireFrom.resolve(specifier);
      } catch (error) {
        if (error.code === "MODULE_NOT_FOUND") {
          problems.push(`${file.slice(packageDir.length + 1)} imports unresolvable "${specifier}"`);
        }
      }
    }
  }
  return [...new Set(problems)];
};

export const packagingTests = (getProject, options = {}) => {
  test("packs every file referenced by the package entry points", () => {
    expect(findMissingEntryFiles(getProject().packageDir, options)).toEqual([]);
  });

  test("declares every dependency imported by the dist bundles", () => {
    expect(findUnresolvableImports(getProject().packageDir, options)).toEqual([]);
  });
};
