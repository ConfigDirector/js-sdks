# Changesets

This folder holds the pending changelog entries ("changesets") for the publishable SDK packages.

## Workflow

1. After making a user-visible change, run `yarn changeset` (or add a markdown file here by hand). Select every public package whose behavior changed and describe the change from the consumer's perspective. Internal packages (`shared`, `client-core`, `browser-client`, `config-evaluator`, `eventsource`) are bundled into the SDKs and are not versioned — list the public SDKs that ship the change instead.
2. At release time, `yarn version-packages` consumes all pending changesets: it bumps each affected package's version and prepends the entries to that package's `CHANGELOG.md`.
3. `yarn release` builds and publishes the bumped packages.

More details: https://github.com/changesets/changesets
