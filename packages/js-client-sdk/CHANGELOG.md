# @configdirector/client-sdk

## 1.6.1

### Patch Changes

- 11bd406: A telemetry failure while recording a context update or while closing the client is now logged as a warning instead of surfacing as an unhandled promise rejection.
- 11bd406: When Web Workers are unavailable, the browser client now turns telemetry off and logs a single warning saying why, instead of leaving an unhandled promise rejection (`ReferenceError: Worker is not defined`) after its first successful connection. This happens in DOM test environments such as jsdom and happy-dom, where the rejection failed Vitest runs even when every test passed, and wherever constructing the worker throws. The client otherwise behaves as before: `initialize` resolves, the client becomes ready, and configs are served normally.

## 1.6.0

### Minor Changes

- 0cd0087: The client-side polling interval for `connection.mode: "polling"` now defaults to 60 seconds (previously 5 minutes) and has a minimum of 30 seconds (previously 60 seconds). A configured `pollingInterval` below the minimum is raised to the minimum and a single warning is logged when the client is created; the interval is never rejected. In `streaming` mode the interval has no effect and nothing is logged.
- a787a58: Added the `@configdirector/client-sdk/testing` entry point. `createTestClient({ values })` returns a `TestClient` whose `client` is a real `ConfigDirectorClient` connected to an in-memory server that the test controls: `setValue`, `removeValue`, and `replaceValues` deliver updates through the production code paths; `holdInitialization`, `completeInitialization`, `failInitialization`, and their `ContextUpdate` counterparts drive `initialize` and `updateContext`; and `contextUpdates` records every context. The test client opens no network connection, sends no telemetry, and leaves nothing running after `dispose`. The entry also exports `ConfigDirectorValidationError` and `ConfigDirectorConnectionError` at runtime, and the package now ships every file under `dist` with a `typesVersions` mapping for the new subpath.
- eeef332: A config whose served value is an empty string now evaluates to the default value with the `value-missing` reason, for every config type and every requested type, as the other ConfigDirector SDKs already do. Previously a string, JSON, or enum config holding an empty string was served as `""` when read as a string, and other reads reported `invalid-number`, `invalid-boolean`, or `invalid-json`. An application that relied on receiving `""` should read the config with `""` as its default value.
- eeef332: `isInitializing` now means the client is trying to get its very first payload. It becomes `true` when `initialize` is called on a client that has never received a payload, stays `true` through timeouts and retries, and becomes `false` when the first payload arrives, when a fatal connection error stops the retries, or on `close`. Previously it stayed `true` forever after a fatal connection error, which kept the Vue plugin from initializing that client again, and it was also set by an `initialize` call on a client that already had a payload. `updateContext` and `resumeNetwork` never set it.
- 67cdcf6: The client now reports configs that a full update from the server no longer includes. The `configsUpdated` event has a new `removedKeys` property listing them, and `keys` still lists only the configs the update included. The `watch` callbacks of a removed config are called with their default value. Previously a removed config silently stopped being served, and its watchers kept acting on the last value they were sent. The OpenFeature providers include removed keys in the `flagsChanged` list of `PROVIDER_CONFIGURATION_CHANGED`.
- eeef332: Client telemetry now starts with the client's first connection instead of when the client is constructed. In the browser the telemetry worker is created on the first successful `initialize`, and in React Native the flush timer starts then. A client that is only constructed and never initialized, such as the discarded instance React StrictMode creates, holds no worker or timer. Evaluations recorded before the first connection are kept, up to the telemetry queue limit, and reported once telemetry starts.

## 1.5.1

### Patch Changes

- Fixed telemetry reporter to include appName and appVersion with telemetry data to support activity graphs.

## 1.5.0

### Minor Changes

- A boolean, integer, or float config requested as a string now evaluates to the default value with the `type-mismatch` reason, instead of the value's text with `found-match`, so the mistake reaches ConfigDirector's type-mismatch alert. Reading a JSON config as a string still returns its raw document.

## 1.4.0

### Minor Changes

- Retry 429 response codes. The SDK server may return a 429 when the account capacity is reached, but the clients must continue to retry in order to reconnect once the limit is cleared.

## 1.3.0

### Minor Changes

- 4f7db37: Changed the default polling interval for `connection.mode: "polling"` from 60 seconds to 5 minutes, and enforced a minimum polling interval of 60 seconds. A configured `pollingInterval` below 60 seconds is raised to 60 seconds and a warning is logged.

## 1.2.0

### Minor Changes

- 41e6f0e: Added a `connectionError` client event and hook that fires when the connection to ConfigDirector fails with an unrecoverable error (for example a revoked SDK key), including when the failure happens after the client was already connected and serving configs. Previously such a post-connection fatal error was silent: the transport stopped reconnecting, the client kept reporting ready, and configs quietly went stale with no way to observe it. The error is now also logged at error level.

### Patch Changes

- 03c1287: Fixed closing the client before it received its first payload leaving `isReady` reporting `true` and firing a spurious `clientReady` event on the closed client. `close()` now also clears the initializing state.
- badf8ae: Fixed a config whose value is legitimately the empty string being treated as missing. `getValue` with a string default now returns `""` (reason `found-match`) instead of falling back to the default with reason `value-missing`. When an empty string cannot satisfy the requested type, the evaluation reason now reflects the actual failure (`invalid-number`, `invalid-boolean`, or `invalid-json`) rather than `value-missing`.
- 48c169c: Fixed the `polling` connection mode leaving its interval timer running after an unrecoverable (4xx) response to a scheduled poll. The transport now closes itself, stopping the useless poll attempts and the repeated warning logs, and `isConnected` correctly reports `false`.
- 556a40e: Fixed the `polling` and `one-time` connection modes permanently stopping after a transient network failure. A thrown network error (device offline, DNS failure, connection reset) is now treated as retryable and polling resumes on the next interval, matching how streaming mode already behaved. Only 4xx responses and permission errors remain unrecoverable.
- 18a02e4: Fixed numeric config value parsing in `getValue` accepting malformed values: trailing garbage (`"42abc"` returned 42), surrounding whitespace, hexadecimal notation, and multi-dot strings (`"1.2.3"` returned 1.2) are now rejected and return the provided default with the evaluation reason `invalid-number`, matching the strict parsing already used by targeting-rule evaluation. Exponent notation on integer configs now parses to its full value (`"1e3"` is 1000, previously 1). Valid values, including fractional values on integer configs (still truncated), are unaffected.
- 2dc8410: Hardened the telemetry flush loop: an unexpected error thrown during a flush no longer kills telemetry collection permanently with an unhandled promise rejection — it is logged and the next flush is scheduled as usual. A flush already in flight when the client is closed no longer re-arms the flush timer after close, and concurrent flush triggers no longer stack multiple parallel flush timers. Closing the client now always completes cleanup even if the final flush attempt fails.
- 7b57427: Fixed `getValue` returning a raw string of the wrong runtime type when the requested type and the config's declared type are incompatible (for example a boolean default against an integer config, or an object default against a string config). Such mismatches now return the provided default value with the evaluation reason `type-mismatch`. A JSON config whose parsed value does not match the requested type (including a literal `null` requested as an object) also returns the default with `type-mismatch` instead of the wrong-typed value. Enum configs requested as a boolean now parse `"true"`/`"false"` values instead of returning the raw string. String defaults continue to accept any config type as-is, and enum values that cast to a consumer-defined string or numeric enum continue to be returned unchanged.
- 30bf04f: Fixed telemetry breaking on insecure origins (plain HTTP), where the browser does not expose `crypto.subtle`. Value-id generation now degrades gracefully by omitting the value id instead of failing, so telemetry events for JSON and long config values are still reported on non-HTTPS deployments such as intranet or local test environments.
- a70b839: Fixed closing the browser client potentially hanging forever waiting for the telemetry web worker to acknowledge shutdown. Closing now times out after 6 seconds and the worker is always terminated — both after a graceful acknowledgment and on timeout — so a crashed or unresponsive worker can no longer leak or stall shutdown.
- 90baebc: Hardened the telemetry web worker integration: closing the client no longer throws in environments without a DOM `document`; and the worker ignores a duplicate initialization message instead of silently starting a second event collector, which split telemetry into separate reports and leaked the first collector's flush timer.

## 1.0.0

Initial public release.
