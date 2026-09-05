# ConfigDirector JavaScript SDKs

This is a Yarn 4 monorepo containing the JavaScript/TypeScript SDKs for the ConfigDirector service.

## Common Commands

```bash
# Root level (runs across all packages)
yarn build       # build all packages via tsdown
yarn lint        # runs linter across all packages
yarn test        # run tests across all packages
yarn test:artifacts  # pack the publishable artifacts and run artifact-tests/ against them

# Within a package
yarn build       # tsdown (public packages only)
yarn lint        # eslint .
yarn test        # vitest (watch mode)
yarn ci:test     # vitest run (no watch — used in CI)
yarn coverage    # vitest run --coverage (server-sdk and config-evaluator only)
yarn clean       # rimraf dist/**
```

## Architecture

**Transport abstraction** — both client and server SDKs support pluggable transports:
- `StreamingTransport`: Server-Sent Events via `eventsource-client`
- `OneTimeTransport`: One-time data fetch (client only)

**Layered structure:**
- Core (`js-client-core`): Base client, transport contracts, emitter
- SDKs (`js-client-sdk`, `react-web-sdk`, `js-server-sdk`): Public API
- Domain (`config-evaluator`, `shared`): Evaluation logic and shared types

**Server-side evaluation** — `config-evaluator` evaluates targeting rules locally using comparison operators for numeric, text, array, date, and semver types. Percent-based rollouts use `rapidhash-js` for consistent hashing.

## Tooling

- **Node.js**: 24 (see `.nvmrc`)
- **Package manager**: Yarn 4.12.0 (`nodeLinker: node-modules`)
- **Bundler**: tsdown (ESM + CJS dual output, minified, with version injection)
- **TypeScript**: 5.9.3, strict mode, project references for composite builds
- **Testing**: Vitest 4 — jsdom for browser packages, node for server packages
- **Linting**: ESLint 10 flat config with `@typescript-eslint` and `@stylistic`
- **Formatting**: Prettier (`bracketSameLine: true`)
- **Git hooks**: shared in `.githooks/`, wired up by the root `postinstall` (`git config core.hooksPath .githooks`). `pre-push` runs typecheck → lint → test → build; bypass with `git push --no-verify`

## Code Style

- 2-space indentation, LF line endings, 110 char line limit
- Double quotes, semicolons, always-multiline trailing commas
- Strict TypeScript — no unused imports or variables
- All public packages output dual ESM (`.mjs`) + CJS (`.cjs`) with matching type declarations (`.d.mts`, `.d.cts`)

## CI

GitHub Actions (`.github/workflows/ci.yml`): `yarn install` → `yarn build` → `yarn test`, plus jobs for
packed-artifact integration tests (`artifact-tests/`), Bun/Deno compatibility, and Nuxt 3 compatibility.

## Artifact Tests

`artifact-tests/` is a standalone project (own `yarn.lock`, not a workspace) that installs each packed
tarball from `artifacts/` into an isolated temp project and verifies packaging (exports map files exist,
every bare import in `dist` resolves) plus functional smokes against a mock SDK server — Node SDKs under
plain `node`, browser SDKs bundled with esbuild and run in Chromium via Playwright. See its README.

## Workflow Rules

- Prefer running a single targeted test over the full test suite during changes
- Run the entire test suite after completing all changes
- When fixing a bug: write a failing test that exposes it first, confirm it fails on the right assertion, then implement the fix.
- Do NOT stage, commit, or stash changes. Do NOT run any destructive git commands. Do NOT run git push, fetch, pull, branch, checkout, stash, etc.
- IMPORTANT: The only git commands you are allowed to use are `git diff`, `git log`, `git show`.
