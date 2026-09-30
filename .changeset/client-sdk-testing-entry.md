---
"@configdirector/client-sdk": minor
---

Added the `@configdirector/client-sdk/testing` entry point. `createTestClient({ values })` returns a `TestClient` whose `client` is a real `ConfigDirectorClient` connected to an in-memory server that the test controls: `setValue`, `removeValue`, and `replaceValues` deliver updates through the production code paths; `holdInitialization`, `completeInitialization`, `failInitialization`, and their `ContextUpdate` counterparts drive `initialize` and `updateContext`; and `contextUpdates` records every context. The test client opens no network connection, sends no telemetry, and leaves nothing running after `dispose`. The entry also exports `ConfigDirectorValidationError` and `ConfigDirectorConnectionError` at runtime, and the package now ships every file under `dist` with a `typesVersions` mapping for the new subpath.
