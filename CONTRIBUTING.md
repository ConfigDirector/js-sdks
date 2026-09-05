# Contributing

## Development

```bash
yarn install     # install dependencies (also wires up the shared git hooks)
yarn build       # build all packages
yarn test        # run all tests
```

The `pre-push` hook runs typecheck → lint → test → build.

## Changesets

Every user-visible change to a publishable package needs a changeset — a pending changelog entry
in `.changeset/`:

```bash
yarn changeset
```

Select each public package whose behavior changed, pick the bump type (patch/minor/major), and
describe the change from the consumer's perspective. Internal packages (`shared`, `client-core`,
`browser-client`, `config-evaluator`, `eventsource`) are bundled into the SDKs and are not
versioned — select the public SDKs that ship the change instead. Commit the generated markdown
file with your change.

## Release process

1. **Version** — on `main`, consume the pending changesets. This bumps each affected package's
   version and prepends the entries to its `CHANGELOG.md`:

   ```bash
   yarn version-packages
   ```

   Review and merge the resulting version/changelog changes.

2. **Validate the artifacts** — pack the exact archives `npm publish` would upload and run the
   integration suite against them:

   ```bash
   yarn test:artifacts
   ```

3. **Publish** — publishing runs in GitHub Actions, not locally. Trigger the
   `release-<package>.yml` workflow for each package being released (or `release-all.yml` for
   all of them) via `workflow_dispatch`. Each workflow runs the package's `release` script
   (lint → test → build → verify dist → `npm publish`) and tags the released commit.
