# Artifact Tests

Integration tests that exercise the packed npm artifacts in `../artifacts/` — the exact archives
`npm publish` would upload. Their purpose is to catch build and packaging bugs that the regular
unit tests cannot see, such as a bundling change that leaves a runtime dependency out of
`dependencies`, or a `files` glob that drops a `dist` file referenced by the exports map.

Each spec installs one artifact with `npm install` into a throwaway project in the system temp
directory — outside the monorepo, so the workspace `node_modules` cannot mask a missing
dependency — together with only the package's declared peer dependencies. It then runs:

- **Packaging checks** — every file referenced by the package entry points (`exports`, `main`,
  `module`, `browser`, `types`, `typesVersions`) exists in the installed package, and every bare
  import specifier in the `dist` bundles resolves from the installed package.
- **Functional smokes** — the SDK is imported for real (ESM and CJS entries where published) and
  driven against a local mock of the ConfigDirector SDK server: initialize, read config values
  over streaming and polling, dispose. Node SDKs run under plain `node`; browser SDKs are bundled
  with esbuild from the installed artifact and executed in Chromium via Playwright, mirroring how
  consumers actually use them.

The react-native artifact only gets the packaging checks, since executing it requires Metro.
The nuxt artifact's module entry is imported and verified to be a Nuxt module; its `dist/runtime`
files reference Nuxt-provided aliases (`#app`, `nitropack/runtime`, `h3`, `vue`) that only resolve
inside a Nuxt app, so those are allowlisted.

## Running

From the repo root:

```bash
yarn test:artifacts
```

This packs fresh artifacts (`yarn pack:local`), installs this project, and runs the suite.
To iterate without repacking:

```bash
cd artifact-tests
yarn install
yarn test
```

Playwright's Chromium must be installed once: `yarn playwright install chromium`.

Set `KEEP_ARTIFACT_FIXTURES=1` to keep the temp fixture projects around for debugging; their
paths start with `configdirector-artifact-` in the system temp directory.

The npm registry must be reachable: peer dependencies (react, vue, `@openfeature/*`,
react-native) are installed fresh into each fixture project.
