import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// Switches a sample app's @configdirector/* dependencies between the published npm
// packages and the locally packed artifacts, then reinstalls.
//
//   node ../scripts/use-sdks.mjs npm     -> installs the versions from `configdirector.npmDependencies`
//   node ../scripts/use-sdks.mjs local   -> installs the tarballs from ../../artifacts
//
// The local tarballs are produced by `yarn pack:local` at the repo root, which builds every
// public package and packs the exact archive `npm publish` would upload. Installing from
// those tarballs is what validates the final artifacts before a release: the bundled
// dist output, the exports map, and the published file list all get exercised for real.

const mode = process.argv[2];
if (mode !== "npm" && mode !== "local") {
  console.error("Usage: node use-sdks.mjs <npm|local>");
  process.exit(1);
}

const appDir = process.cwd();
const packageJsonPath = join(appDir, "package.json");
const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const artifactsDir = resolve(appDir, "..", "..", "artifacts");

const npmDependencies = pkg.configdirector?.npmDependencies;
if (!npmDependencies || Object.keys(npmDependencies).length === 0) {
  console.error(
    "This app's package.json has no `configdirector.npmDependencies` entry, so there is nothing to switch.",
  );
  process.exit(1);
}

const tarballPathFor = (name) => join(artifactsDir, `${name.replace("/", "-")}.tgz`);

const changes = [];
for (const [name, npmRange] of Object.entries(npmDependencies)) {
  const section = ["dependencies", "devDependencies"].find((s) => pkg[s]?.[name] !== undefined);
  if (!section) {
    console.error(`${name} is listed in configdirector.npmDependencies but is not a dependency.`);
    process.exit(1);
  }

  let target = npmRange;
  if (mode === "local") {
    const tarball = tarballPathFor(name);
    if (!existsSync(tarball)) {
      console.error(`Missing ${tarball}.\nRun 'yarn pack:local' at the repo root first.`);
      process.exit(1);
    }
    target = `file:${relative(appDir, tarball)}`;
  }

  if (pkg[section][name] !== target) {
    pkg[section][name] = target;
    changes.push(`${name} -> ${target}`);
  }
}

writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
for (const change of changes) {
  console.log(change);
}

console.log("Installing with 'yarn install'...");
execSync("yarn install", { cwd: appDir, stdio: "inherit" });
console.log(`Now using the ${mode === "local" ? "locally packed artifacts" : "npm packages"}.`);
