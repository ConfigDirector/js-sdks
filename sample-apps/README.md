# Sample Apps

Each sample app can install the ConfigDirector SDKs from two sources:

- **npm** (the default): the published packages, at the versions pinned in each app's
  `configdirector.npmDependencies` field.
- **Local artifacts**: tarballs packed from this working tree. These are the exact archives
  `npm publish` would upload — the bundled `dist` output, the exports map, and the published
  file list — so installing from them validates the final artifacts before a release.

## Using the local artifacts

1. Pack the artifacts at the repo root (this builds every public package first):

   ```bash
   yarn pack:local
   ```

   This writes one tarball per public package into `artifacts/`.

2. Switch the sample app to the tarballs and reinstall:

   ```bash
   cd sample-apps/<app>
   yarn sdk:local
   ```

3. Run the app as usual (`dev`, `build`, ...).

After changing SDK code, re-run `yarn pack:local` and `yarn sdk:local` to pick up fresh
tarballs.

## Tests

Each sample app has tests that run with `yarn test`, without a network connection or an SDK key:

- `js-client`, `nextjs`, and `react-native` test their screens and routes with the SDK's testing
  entry point (`@configdirector/client-sdk/testing`, `@configdirector/nextjs-sdk/client/testing`
  and `/server/testing`, `@configdirector/react-native-sdk/testing`), which gives the code under
  test a real client connected to an in-memory server.
- `openfeature-web` and `openfeature-server` test against OpenFeature's `TypedInMemoryProvider`,
  since code that uses a provider talks to the OpenFeature API.

`js-client` and `openfeature-web` run under vitest with jsdom against the markup in `index.html`.
`nextjs` renders its pages with React Testing Library and calls its route handler directly.
`openfeature-server` starts the server from `src/app.ts` on a free port. `react-native` runs under
`jest-expo` and also renders the whole app through `renderRouter` with an installed test client;
its `jest.config.js` shows the transform the SDK's `.mjs` files need.

The tests run against whichever source is installed: the published packages by default, or the
packed tarballs after `yarn sdk:local`, which is how an unreleased SDK change gets checked against
the samples before a release.

## Switching back to npm

```bash
yarn sdk:npm
```

This restores the versions from `configdirector.npmDependencies` and reinstalls.

Both commands rewrite the `@configdirector/*` entries in the app's `package.json` and its
`yarn.lock`, so expect those files to change; the committed state should stay on the npm
versions.
