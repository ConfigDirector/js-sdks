import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const artifactsDir = join(repoRoot, "artifacts");
const fixturesDir = resolve(import.meta.dirname, "..", "fixtures");

export const tarballPath = (packageName) => join(artifactsDir, `${packageName.replace("/", "-")}.tgz`);

export const createFixtureProject = async ({ packageName, dependencies = {}, fixture }) => {
  const tarball = tarballPath(packageName);
  if (!existsSync(tarball)) {
    throw new Error(`Missing artifact ${tarball}. Run 'yarn pack:local' at the repo root first.`);
  }

  const dir = await mkdtemp(join(tmpdir(), "configdirector-artifact-"));
  const packageJson = {
    name: "artifact-smoke",
    private: true,
    dependencies: { [packageName]: `file:${tarball}`, ...dependencies },
  };
  await writeFile(join(dir, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  if (fixture) {
    await cp(join(fixturesDir, fixture), dir, { recursive: true });
  }

  const install = await run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], dir);
  if (install.code !== 0) {
    await rm(dir, { recursive: true, force: true });
    throw new Error(`npm install failed for ${packageName}:\n${install.stdout}\n${install.stderr}`);
  }

  return {
    dir,
    packageName,
    packageDir: join(dir, "node_modules", ...packageName.split("/")),
    runNode: (script, env = {}) => run(process.execPath, [script], dir, env),
    cleanup: async () => {
      if (!process.env.KEEP_ARTIFACT_FIXTURES) {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
};

export const parseReport = (stdout) => {
  const lines = stdout.trim().split("\n");
  return JSON.parse(lines[lines.length - 1]);
};

const run = (command, args, cwd, env = {}, timeoutMs = 180_000) =>
  new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectPromise(
        new Error(`Timed out after ${timeoutMs}ms: ${command} ${args.join(" ")}\n${stdout}\n${stderr}`),
      );
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectPromise(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ code, stdout, stderr });
    });
  });
