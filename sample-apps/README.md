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

## Switching back to npm

```bash
yarn sdk:npm
```

This restores the versions from `configdirector.npmDependencies` and reinstalls.

Both commands rewrite the `@configdirector/*` entries in the app's `package.json` and its
`yarn.lock`, so expect those files to change; the committed state should stay on the npm
versions.
