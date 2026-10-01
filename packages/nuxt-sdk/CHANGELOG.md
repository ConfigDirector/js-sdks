# @configdirector/nuxt-sdk

## 1.8.0

### Minor Changes

- 0cd0087: The client-side polling interval for `connection.mode: "polling"` now defaults to 60 seconds (previously 5 minutes) and has a minimum of 30 seconds (previously 60 seconds). A configured `pollingInterval` below the minimum is raised to the minimum and a single warning is logged when the client is created; the interval is never rejected. In `streaming` mode the interval has no effect and nothing is logged.
- eeef332: A config whose served value is an empty string now evaluates to the default value with the `value-missing` reason, for every config type and every requested type, as the other ConfigDirector SDKs already do. Previously a string, JSON, or enum config holding an empty string was served as `""` when read as a string, and other reads reported `invalid-number`, `invalid-boolean`, or `invalid-json`. An application that relied on receiving `""` should read the config with `""` as its default value.
- eeef332: `isInitializing` now means the client is trying to get its very first payload. It becomes `true` when `initialize` is called on a client that has never received a payload, stays `true` through timeouts and retries, and becomes `false` when the first payload arrives, when a fatal connection error stops the retries, or on `close`. Previously it stayed `true` forever after a fatal connection error, which kept the Vue plugin from initializing that client again, and it was also set by an `initialize` call on a client that already had a payload. `updateContext` and `resumeNetwork` never set it.
- df7f3d1: Added the `@configdirector/nuxt-sdk/testing` entry point with `createTestClient({ values })`, whose `client` is a real `ConfigDirectorClient` connected to an in-memory server that the test controls, and `installTestClient(testClient)`, which makes the ConfigDirector plugin provide that client to the Nuxt app instead of building one, for tests in the `nuxt` vitest environment of `@nuxt/test-utils` 4 (version 3 creates the app before the test file loads, so an installed client cannot reach the plugin there). While a test client is installed, the plugin does not require a `clientSdkKey` and ignores the public `configdirector` runtime config. The plugin now initializes the client only when it is neither ready nor initializing, and updates its context instead when the client is ready and the app's context differs. The entry also exports `ConfigDirectorValidationError` and `ConfigDirectorConnectionError` at runtime, and the package has a `typesVersions` mapping for the new subpath.
- 0cd0087: The connection `mode` (`streaming` or `polling`) and `pollingInterval` (in seconds) options of the underlying client SDK can now be set from the framework wrappers. The React, Vue, React Native and Next.js client providers accept them as `mode` and `pollingInterval` next to `url` and `timeout`. The Nuxt module reads them for the browser client from `runtimeConfig.public.configdirector.connection` (`mode`, `pollingInterval` and `timeout`), which can also be set through the `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_MODE`, `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_POLLING_INTERVAL` and `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_TIMEOUT` environment variables, mirroring the existing server-side `runtimeConfig.configdirector.connection` keys.
- 67cdcf6: The client now reports configs that a full update from the server no longer includes. The `configsUpdated` event has a new `removedKeys` property listing them, and `keys` still lists only the configs the update included. The `watch` callbacks of a removed config are called with their default value. Previously a removed config silently stopped being served, and its watchers kept acting on the last value they were sent. The OpenFeature providers include removed keys in the `flagsChanged` list of `PROVIDER_CONFIGURATION_CHANGED`.
- 0cd0087: The server-side polling interval for `connection.mode: "polling"` keeps its default of 300 seconds (5 minutes) and now has a minimum of 60 seconds. A configured `pollingInterval` below the minimum is raised to the minimum and a single warning is logged when the client is created; the interval is never rejected. In `streaming` mode the interval has no effect and nothing is logged. The `pollingInterval` option documentation, which wrongly stated a default of 60 seconds, now states the actual default and the minimum.
- eeef332: Client telemetry now starts with the client's first connection instead of when the client is constructed. In the browser the telemetry worker is created on the first successful `initialize`, and in React Native the flush timer starts then. A client that is only constructed and never initialized, such as the discarded instance React StrictMode creates, holds no worker or timer. Evaluations recorded before the first connection are kept, up to the telemetry queue limit, and reported once telemetry starts.

### Patch Changes

- 3794556: Trait pointers in targeting rules now follow RFC 6901 exactly. A pointer that does not start with `/` no longer resolves by dropping its first character, and a pointer with an escape other than `~0` or `~1` no longer resolves to a member named with the literal text; both now resolve to a missing trait. The SDKs no longer depend on `@jsonjoy.com/json-pointer`, whose packages require `tslib` without declaring it as a dependency, so the SDKs failed to load with `Cannot find module 'tslib'` in Yarn projects that did not otherwise install it.
- eeef332: The Node.js server SDK no longer keeps the event loop alive after it has stopped mattering. The timers that bound `initialize` and the streaming connection are cleared as soon as they settle, the telemetry flush timer starts with the first `initialize` instead of when the client is constructed, and the streaming heartbeat stops after a fatal connection error. `dispose()` now also ends a pending `initialize`, which resolves promptly without marking the client ready or emitting `clientReady`. The Nuxt module's `useConfigDirectorContext` clears the timer that bounds `updateContext` the same way.

## 1.7.0

### Minor Changes

- Default percentage rollouts to the first bucket when there is no context identifier on server evaluations.

## 1.6.1

### Patch Changes

- Fixed telemetry reporter to include appName and appVersion with telemetry data to support activity graphs.

## 1.6.0

### Minor Changes

- A boolean, integer, or float config requested as a string now evaluates to the default value with the `type-mismatch` reason, instead of the value's text with `found-match`, so the mistake reaches ConfigDirector's type-mismatch alert. Reading a JSON config as a string still returns its raw document.

## 1.5.0

### Minor Changes

- Fix bug in conditional rule evaluation incorrectly evaluating multiple conditions in an OR instead of AND

## 1.4.0

### Minor Changes

- Retry 429 response codes. The SDK server may return a 429 when the account capacity is reached, but the clients must continue to retry in order to reconnect once the limit is cleared.

## 1.3.0

### Minor Changes

- f7153c2: Fixed requests arriving before the server SDK client received its initial config payload (for example right after the Nuxt server starts) rendering with default values. Such requests are now held until the payload arrives, for up to the client's initialization timeout, after which they proceed with defaults as before. This can be disabled with the new `runtimeConfig.configdirector.waitForInitialization` option (or `NUXT_CONFIGDIRECTOR_WAIT_FOR_INITIALIZATION=false`). The server client's connection options are now configurable under `runtimeConfig.configdirector.connection` (`mode`, `pollingInterval`, `timeout`), including through the matching `NUXT_CONFIGDIRECTOR_CONNECTION_*` environment variables, and the Nitro app exposes the client's initialization promise as `configDirectorInitialization` for code running outside the request lifecycle.
- 4f7db37: Changed the default polling interval for `connection.mode: "polling"` from 60 seconds to 5 minutes, and enforced a minimum polling interval of 60 seconds. A configured `pollingInterval` below 60 seconds is raised to 60 seconds and a warning is logged.

## 1.2.0

### Minor Changes

- 41e6f0e: Added a `connectionError` client event and hook that fires when the connection to ConfigDirector fails with an unrecoverable error (for example a revoked SDK key), including when the failure happens after the client was already connected and serving configs. Previously such a post-connection fatal error was silent: the transport stopped reconnecting, the client kept reporting ready, and configs quietly went stale with no way to observe it. The error is now also logged at error level.

### Patch Changes

- 03c1287: Fixed closing the client before it received its first payload leaving `isReady` reporting `true` and firing a spurious `clientReady` event on the closed client. `close()` now also clears the initializing state.
- badf8ae: Fixed a config whose value is legitimately the empty string being treated as missing. `getValue` with a string default now returns `""` (reason `found-match`) instead of falling back to the default with reason `value-missing`. When an empty string cannot satisfy the requested type, the evaluation reason now reflects the actual failure (`invalid-number`, `invalid-boolean`, or `invalid-json`) rather than `value-missing`.
- bc35fe0: Fixed a server-side memory leak where every SSR render of a component using `useConfigDirectorValue` permanently registered a watch handler (capturing that request's user context) on the shared server SDK client. Watch registrations are now inert during SSR — the rendered HTML is a point-in-time snapshot and cannot receive updates — so the shared client's handler list stays bounded and no telemetry is emitted for long-gone requests when configs update.
- 48c169c: Fixed the `polling` connection mode leaving its interval timer running after an unrecoverable (4xx) response to a scheduled poll. The transport now closes itself, stopping the useless poll attempts and the repeated warning logs, and `isConnected` correctly reports `false`.
- 556a40e: Fixed the `polling` and `one-time` connection modes permanently stopping after a transient network failure. A thrown network error (device offline, DNS failure, connection reset) is now treated as retryable and polling resumes on the next interval, matching how streaming mode already behaved. Only 4xx responses and permission errors remain unrecoverable.
- 428823f: Fixed `dispose()` on the server client leaving the telemetry flush timer running, which kept the Node.js event loop alive indefinitely and prevented graceful process shutdown. Disposing the client now stops telemetry collection and flushes any pending telemetry events in the background.
- 18a02e4: Fixed numeric config value parsing in `getValue` accepting malformed values: trailing garbage (`"42abc"` returned 42), surrounding whitespace, hexadecimal notation, and multi-dot strings (`"1.2.3"` returned 1.2) are now rejected and return the provided default with the evaluation reason `invalid-number`, matching the strict parsing already used by targeting-rule evaluation. Exponent notation on integer configs now parses to its full value (`"1e3"` is 1000, previously 1). Valid values, including fractional values on integer configs (still truncated), are unaffected.
- 2dc8410: Hardened the telemetry flush loop: an unexpected error thrown during a flush no longer kills telemetry collection permanently with an unhandled promise rejection — it is logged and the next flush is scheduled as usual. A flush already in flight when the client is closed no longer re-arms the flush timer after close, and concurrent flush triggers no longer stack multiple parallel flush timers. Closing the client now always completes cleanup even if the final flush attempt fails.
- 7b57427: Fixed `getValue` returning a raw string of the wrong runtime type when the requested type and the config's declared type are incompatible (for example a boolean default against an integer config, or an object default against a string config). Such mismatches now return the provided default value with the evaluation reason `type-mismatch`. A JSON config whose parsed value does not match the requested type (including a literal `null` requested as an object) also returns the default with `type-mismatch` instead of the wrong-typed value. Enum configs requested as a boolean now parse `"true"`/`"false"` values instead of returning the raw string. String defaults continue to accept any config type as-is, and enum values that cast to a consumer-defined string or numeric enum continue to be returned unchanged.
- 30bf04f: Fixed telemetry breaking on insecure origins (plain HTTP), where the browser does not expose `crypto.subtle`. Value-id generation now degrades gracefully by omitting the value id instead of failing, so telemetry events for JSON and long config values are still reported on non-HTTPS deployments such as intranet or local test environments.
- a70b839: Fixed closing the browser client potentially hanging forever waiting for the telemetry web worker to acknowledge shutdown. Closing now times out after 6 seconds and the worker is always terminated — both after a graceful acknowledgment and on timeout — so a crashed or unresponsive worker can no longer leak or stall shutdown.
- 90baebc: Hardened the telemetry web worker integration: closing the client no longer throws in environments without a DOM `document`; and the worker ignores a duplicate initialization message instead of silently starting a second event collector, which split telemetry into separate reports and leaked the first collector's flush timer.

## 1.0.0

Initial public release.
