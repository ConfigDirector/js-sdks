---
"@configdirector/vue-sdk": minor
---

Added the `@configdirector/vue-sdk/testing` entry point with `createTestClient({ values })`, whose `client` is a real `ConfigDirectorClient` connected to an in-memory server that the test controls; install it with `app.use(ConfigDirectorPlugin, testClient.client)`. `ConfigDirectorPlugin` now recognizes a client structurally (by its `initialize`, `getValue`, `watch`, and `on` members) instead of by its class, and the package exports the `ConfigDirectorClient`, `ConfigDirectorContext`, `ConfigDirectorPluginOptions`, and `ClientStatus` types. The entry also exports `ConfigDirectorValidationError` and `ConfigDirectorConnectionError` at runtime, and the package now ships every file under `dist` with a `typesVersions` mapping for the new subpath.
