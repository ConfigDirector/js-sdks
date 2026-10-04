# @configdirector/react-native-sdk

## 1.6.1

### Patch Changes

- 11bd406: A telemetry failure while recording a context update or while closing the client is now logged as a warning instead of surfacing as an unhandled promise rejection.

## 1.6.0

### Minor Changes

- 0cd0087: The client-side polling interval for `connection.mode: "polling"` now defaults to 60 seconds (previously 5 minutes) and has a minimum of 30 seconds (previously 60 seconds). A configured `pollingInterval` below the minimum is raised to the minimum and a single warning is logged when the client is created; the interval is never rejected. In `streaming` mode the interval has no effect and nothing is logged.
- eeef332: A config whose served value is an empty string now evaluates to the default value with the `value-missing` reason, for every config type and every requested type, as the other ConfigDirector SDKs already do. Previously a string, JSON, or enum config holding an empty string was served as `""` when read as a string, and other reads reported `invalid-number`, `invalid-boolean`, or `invalid-json`. An application that relied on receiving `""` should read the config with `""` as its default value.
- eeef332: `isInitializing` now means the client is trying to get its very first payload. It becomes `true` when `initialize` is called on a client that has never received a payload, stays `true` through timeouts and retries, and becomes `false` when the first payload arrives, when a fatal connection error stops the retries, or on `close`. Previously it stayed `true` forever after a fatal connection error, which kept the Vue plugin from initializing that client again, and it was also set by an `initialize` call on a client that already had a payload. `updateContext` and `resumeNetwork` never set it.
- 0cd0087: The connection `mode` (`streaming` or `polling`) and `pollingInterval` (in seconds) options of the underlying client SDK can now be set from the framework wrappers. The React, Vue, React Native and Next.js client providers accept them as `mode` and `pollingInterval` next to `url` and `timeout`. The Nuxt module reads them for the browser client from `runtimeConfig.public.configdirector.connection` (`mode`, `pollingInterval` and `timeout`), which can also be set through the `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_MODE`, `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_POLLING_INTERVAL` and `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_TIMEOUT` environment variables, mirroring the existing server-side `runtimeConfig.configdirector.connection` keys.
- 5120679: Whichever of `appName` and `appVersion` is left unset is now read from the platform when the app has `expo-application` or `react-native-device-info` installed, as the Swift and Flutter SDKs already do from their bundles. Setting a value still sends that value instead. When one cannot be read, the client says so at `info` when it is created, since React Native itself does not expose the app name or version.
- 2e68259: `ConfigDirectorProvider` accepts a `client` prop, an existing `ConfigDirectorClient` to provide instead of building one from `sdkKey`; its props are now `ConfigDirectorProviderProps`, the union of `ConfigDirectorProviderOptions` and `ConfigDirectorProviderClientProps` (which also takes `netInfoSubscribe`), and the package exports these types. A provider never disposes a client it was given, only one it built. It does not initialize a given client that is ready or initializing, updates the context only when the `context` prop is given and differs from the client's context, and reports the ready status on its first render when the client is already ready. `hooks` given with a `client` are registered on it while the provider is mounted. Every handler the provider registers is removed when it unmounts. The `context` prop is compared by deep equality, so a new object with the same contents no longer reconnects. A changed `client` prop after mount is ignored with a warning.

  Added the `@configdirector/react-native-sdk/testing` entry point with `createTestClient({ values })` and `installTestClient(testClient)`, which makes every provider mounted without a `client` prop use the test client's client until it is uninstalled. The entry also exports `ConfigDirectorValidationError` and `ConfigDirectorConnectionError` at runtime, with a `typesVersions` mapping for the new subpath.

- 67cdcf6: The client now reports configs that a full update from the server no longer includes. The `configsUpdated` event has a new `removedKeys` property listing them, and `keys` still lists only the configs the update included. The `watch` callbacks of a removed config are called with their default value. Previously a removed config silently stopped being served, and its watchers kept acting on the last value they were sent. The OpenFeature providers include removed keys in the `flagsChanged` list of `PROVIDER_CONFIGURATION_CHANGED`.
- eeef332: Client telemetry now starts with the client's first connection instead of when the client is constructed. In the browser the telemetry worker is created on the first successful `initialize`, and in React Native the flush timer starts then. A client that is only constructed and never initialized, such as the discarded instance React StrictMode creates, holds no worker or timer. Evaluations recorded before the first connection are kept, up to the telemetry queue limit, and reported once telemetry starts.

### Patch Changes

- eeef332: `ConfigDirectorProvider` now subscribes to `AppState` and NetInfo before it awaits `initialize`, so a provider that unmounts before initialization finishes removes both subscriptions. Previously the subscriptions were added after `initialize` resolved, and an early unmount (for example under React StrictMode) left them registered for good.
- eeef332: `ConfigDirectorProvider` builds a new client when React mounts it again after it disposed its own, which React StrictMode does in development. Previously the remounted provider initialized the disposed client again, which reconnected but had lost its telemetry and the `hooks` given to the provider.

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
- a70b839: Fixed closing the browser client potentially hanging forever waiting for the telemetry web worker to acknowledge shutdown. Closing now times out after 6 seconds and the worker is always terminated — both after a graceful acknowledgment and on timeout — so a crashed or unresponsive worker can no longer leak or stall shutdown.
- 90baebc: Hardened the telemetry web worker integration: closing the client no longer throws in environments without a DOM `document`; and the worker ignores a duplicate initialization message instead of silently starting a second event collector, which split telemetry into separate reports and leaked the first collector's flush timer.

## 1.0.0

Initial public release.
