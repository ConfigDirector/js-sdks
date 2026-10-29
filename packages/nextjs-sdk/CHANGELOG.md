# @configdirector/nextjs-sdk

## 1.13.1

### Patch Changes

- c11f5d0: In polling mode, `updateContext` now gets the values for the new context, and `resumeNetwork` makes the client ready again. Before, when no config had changed since the client's last values, `updateContext` kept serving the previous context's values, and the client stayed not ready and logged a timeout warning until a config changed. In React Native, the same happened after the app came back to the foreground or got its connection back. Each `initialize`, `updateContext` and `resumeNetwork` in polling mode now downloads the full set of values.

## 1.13.0

### Minor Changes

- 7a328c3: Added `evaluate(key, defaultValue)`, which returns the value together with the reason it was served and its value ID, the same evaluation that `configEvaluated` reports. The `ConfigEvaluation` and `EvaluationReason` types are exported.

  Added `evaluate(key, defaultValue, context)`, which returns the value together with the reason it was served and its value ID, the same evaluation that `configEvaluated` reports. The `ConfigEvaluation` and `EvaluationReason` types are exported. Evaluations now carry the value ID ConfigDirector assigned to the value served.

### Patch Changes

- f305d86: A JSON config read with an object as its in-code default value now gives the config's value only when that value is a JSON object, and one read with an array as its in-code default value only when the value is a JSON array. Before, a JSON array reached a read with an object, and a JSON object a read with an array. Such a read now gives the in-code default value with the reason `type-mismatch`, or the error code `TYPE_MISMATCH` through the OpenFeature providers. It is reported to ConfigDirector, so the dashboard shows the Config type mismatch alert for the config, as it does for other mismatches.
- 399ee39: The values the browser half keeps in `localStorage` no longer include the client SDK key, only its SHA-256 digest. Values kept by an earlier version are removed on the first page load after the upgrade, so a page that reads the client directly sees the in-code default values on that load until live values arrive.

## 1.12.1

### Patch Changes

- 7dab866: The SDK now sends its instance ID with telemetry, the same ID it connects with, so ConfigDirector can tell which browser the telemetry came from.

## 1.12.0

### Minor Changes

- a8456cf: The instance ID the SDK stores in the browser's `localStorage` now lasts until the site's data is cleared, instead of being replaced six hours after it was created, so an anonymous visitor counts as one monthly active user a month. An instance ID stored by an earlier version of the SDK is kept.
- 82d1787: The client `ConfigDirectorProvider` opens its first browser connection after the effects of its first render, including its children's, have run. It connects with the latest context given by then: one given through `updateContext` from `useContext` during those effects, such as from a mount effect, otherwise the `context` prop. A mount-effect `updateContext` therefore opens one connection carrying that context instead of being dropped. `updateContext` keeps one identity across renders, so it is safe in an effect's dependency list. An `updateContext` call, or a `context` prop, equal to the context the provider already has opens no new connection.

  The new `deferInitialization` prop, on the server and the client provider, holds the connection until a context is given. With it on, nothing connects and nothing is sent, `useConfigDirectorStatus` reports `loading`, and the hooks serve the server's initial configs or the in-code default values until the first context, from the prop or from `updateContext`, opens one connection carrying it; the values kept on the device for that context are served until live values arrive. A page that never gives a context never connects and stays `loading`. The prop defaults to `false` and has no effect in `offline` mode.

- e80c752: The browser half keeps the last values it received from ConfigDirector in `localStorage` and serves them on the next page load of the same context until live values arrive, with the new evaluation reason `cached`; the hooks keep showing the server-rendered values until the client is ready, as before, so a page sees this only where it reads the client directly. The entry lives under a key derived from the client SDK key with a size limit of 256 KB, and nothing is kept in `offline` mode. The client provider takes no option to turn this off yet.

## 1.11.0

### Minor Changes

- 71291eb: The server and the browser halves run from one offline source. `register()` accepts `connection: { mode: "offline", file }` or `connection: { mode: "offline", values }` without a `serverSdkKey`: the server singleton never connects to ConfigDirector, sends nothing, and serves those values to every context, or the in-code default values when neither is given. `register()` now rejects with `ConfigDirectorInitializationError`, exported from `@configdirector/nextjs-sdk/server` along with the `OfflineClientOptions`, `OfflineValues` and `OfflineValue` types, when the offline values cannot be loaded: a missing, unreadable or non-object file, a value such as `null`, `file` and `values` given together, or either given in `streaming` or `polling` mode; the singleton is not installed in that case. A missing key in any other mode fails as before. When `register()` ran offline, the server `ConfigDirectorProvider` hands the server's values to the client provider as `mode="offline"` and `values`, narrowed by `configKeys`, unless the provider is given its own `mode` or `values` props, which are forwarded unchanged. Both providers now take `sdkKey` optionally, accept `mode="offline"`, and take a `values` prop, one value per config key, which the browser client serves without connecting; `@configdirector/nextjs-sdk/client` exports the `OfflineValues` and `OfflineValue` types. In offline mode `useConfigDirectorStatus` reports `loading` during server rendering and hydration and `ready` once the provider mounts, and `url`, `timeout` and `pollingInterval` have no effect. A change to the `context` prop of an offline provider stores the new context, keeps the values, and returns the status to `ready`.

### Patch Changes

- 5e0d51d: The client `ConfigDirectorProvider` now keeps its status and values updating for a client passed in the `client` prop, or an installed test client, after React StrictMode remounts it in development. Previously, in `next dev` and in tests rendered under `<StrictMode>`, `useConfigDirectorStatus` stayed `loading` and `useConfigValue` returned the in-code default value when the client was not ready yet, and config changes never re-rendered the components that read them when it was. The `hooks` passed to the provider also stopped firing, and a change to its `context` prop never reached the client. Production builds were not affected.

## 1.10.0

### Minor Changes

- 7ea20eb: In the browser, the client `ConfigDirectorProvider` evaluates targeting rules on the context's `kind`. A context with an invalid kind never makes the client throw: `initialize` and `updateContext` log an error, stop using the previous context, and connect as if no context had been supplied, so flags evaluate for no context, `context` reads as none, and `contextUpdated` reports none. ConfigDirector receives a count of these calls with a sample of each invalid kind, never the context's identifier, name or traits. This applies to the provider's `context` prop and to `useContext().updateContext`. The test client records such a call as an empty context in `contextUpdates`.
- 248d226: On the server, `ConfigDirectorContext` has a new optional `kind` field that says what kind of entity the context represents, such as `device`, `organization` or `tenant`; leaving it out means `user`. The server SDK client, `generateSsrConfigSet` and the server `ConfigDirectorProvider` evaluate targeting rules on it. A kind has 1 to 64 characters, using only lowercase letters, digits, `-` and `_`. A context with any other kind never makes them throw: they evaluate exactly as if no context had been supplied and log an error for each distinct invalid kind once per telemetry flush interval, and the server test client logs every such read.

## 1.9.2

### Patch Changes

- 672b190: A segment change now reaches watchers. When an update from the server carries a segment, the `watch` callbacks of every config whose targeting rules use that segment are called with the newly evaluated value, and the `configsUpdated` event lists those configs in `keys` beside the configs the update included. Previously, editing a segment or one of its environment overrides changed the values served without calling any watcher, and `configsUpdated` reported no keys. The OpenFeature provider lists the same configs in the `flagsChanged` list of `PROVIDER_CONFIGURATION_CHANGED`.

## 1.9.1

### Patch Changes

- 11bd406: A telemetry failure while recording a context update or while closing the client is now logged as a warning instead of surfacing as an unhandled promise rejection.
- 11bd406: When Web Workers are unavailable, the browser client now turns telemetry off and logs a single warning saying why, instead of leaving an unhandled promise rejection (`ReferenceError: Worker is not defined`) after its first successful connection. This happens in DOM test environments such as jsdom and happy-dom, where the rejection failed Vitest runs even when every test passed, and wherever constructing the worker throws. The client otherwise behaves as before: `initialize` resolves, the client becomes ready, and configs are served normally.

## 1.9.0

### Minor Changes

- Targeting rules can now use segments. The SDK reads the `segments` section of the server payload and evaluates segment conditions (`in` / `not in` a segment) locally, combined by AND with the rule's other conditions as every condition already is. Segments received in a full update replace the ones held, and a delta adds to them. ConfigDirector only sends rules with segment conditions to SDK versions that evaluate them, so upgrading is what makes rules that use segments apply to this application.

## 1.8.0

### Minor Changes

- 0cd0087: The client-side polling interval for `connection.mode: "polling"` now defaults to 60 seconds (previously 5 minutes) and has a minimum of 30 seconds (previously 60 seconds). A configured `pollingInterval` below the minimum is raised to the minimum and a single warning is logged when the client is created; the interval is never rejected. In `streaming` mode the interval has no effect and nothing is logged.
- eeef332: A config whose served value is an empty string now evaluates to the default value with the `value-missing` reason, for every config type and every requested type, as the other ConfigDirector SDKs already do. Previously a string, JSON, or enum config holding an empty string was served as `""` when read as a string, and other reads reported `invalid-number`, `invalid-boolean`, or `invalid-json`. An application that relied on receiving `""` should read the config with `""` as its default value.
- eeef332: `isInitializing` now means the client is trying to get its very first payload. It becomes `true` when `initialize` is called on a client that has never received a payload, stays `true` through timeouts and retries, and becomes `false` when the first payload arrives, when a fatal connection error stops the retries, or on `close`. Previously it stayed `true` forever after a fatal connection error, which kept the Vue plugin from initializing that client again, and it was also set by an `initialize` call on a client that already had a payload. `updateContext` and `resumeNetwork` never set it.
- 2e68259: The client `ConfigDirectorProvider` accepts a `client` prop, an existing `ConfigDirectorClient` to provide instead of building one from `sdkKey`; its props are now `ConfigDirectorClientProviderProps`, the union of `ConfigDirectorProviderOptions` and `ConfigDirectorClientProviderClientProps` (which also takes `initialConfigs`), and the `/client` entry exports both types. A given client is provided on the first render, so `useClient` no longer throws there, and the provider reports the ready status at once when the client is ready. A provider never disposes a client it was given, only one it built. It does not initialize a given client that is ready or initializing, updates the context only when the `context` prop is given and differs from the client's context, registers `hooks` given with a `client` while it is mounted, and removes every handler it registered when it unmounts. The `context` prop is compared by deep equality, so a new object with the same contents no longer reconnects. A changed `client` prop after mount is ignored with a warning.

  Added the `@configdirector/nextjs-sdk/client/testing` entry point with `createTestClient({ values })` and `installTestClient(testClient)`, and the `@configdirector/nextjs-sdk/server/testing` entry point with `createTestClient({ values })` for the server SDK and `installServerTestClient(testClient)`, which puts the test client's client where `register()` puts the server singleton and returns a function that restores the previous one. Both entries export `ConfigDirectorValidationError` and `ConfigDirectorConnectionError` at runtime, and the package has `typesVersions` mappings for the new subpaths.

- 0cd0087: The connection `mode` (`streaming` or `polling`) and `pollingInterval` (in seconds) options of the underlying client SDK can now be set from the framework wrappers. The React, Vue, React Native and Next.js client providers accept them as `mode` and `pollingInterval` next to `url` and `timeout`. The Nuxt module reads them for the browser client from `runtimeConfig.public.configdirector.connection` (`mode`, `pollingInterval` and `timeout`), which can also be set through the `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_MODE`, `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_POLLING_INTERVAL` and `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_TIMEOUT` environment variables, mirroring the existing server-side `runtimeConfig.configdirector.connection` keys.
- 67cdcf6: The client now reports configs that a full update from the server no longer includes. The `configsUpdated` event has a new `removedKeys` property listing them, and `keys` still lists only the configs the update included. The `watch` callbacks of a removed config are called with their default value. Previously a removed config silently stopped being served, and its watchers kept acting on the last value they were sent. The OpenFeature providers include removed keys in the `flagsChanged` list of `PROVIDER_CONFIGURATION_CHANGED`.
- 0cd0087: The server-side polling interval for `connection.mode: "polling"` keeps its default of 300 seconds (5 minutes) and now has a minimum of 60 seconds. A configured `pollingInterval` below the minimum is raised to the minimum and a single warning is logged when the client is created; the interval is never rejected. In `streaming` mode the interval has no effect and nothing is logged. The `pollingInterval` option documentation, which wrongly stated a default of 60 seconds, now states the actual default and the minimum.
- eeef332: Client telemetry now starts with the client's first connection instead of when the client is constructed. In the browser the telemetry worker is created on the first successful `initialize`, and in React Native the flush timer starts then. A client that is only constructed and never initialized, such as the discarded instance React StrictMode creates, holds no worker or timer. Evaluations recorded before the first connection are kept, up to the telemetry queue limit, and reported once telemetry starts.

### Patch Changes

- 3794556: Trait pointers in targeting rules now follow RFC 6901 exactly. A pointer that does not start with `/` no longer resolves by dropping its first character, and a pointer with an escape other than `~0` or `~1` no longer resolves to a member named with the literal text; both now resolve to a missing trait. The SDKs no longer depend on `@jsonjoy.com/json-pointer`, whose packages require `tslib` without declaring it as a dependency, so the SDKs failed to load with `Cannot find module 'tslib'` in Yarn projects that did not otherwise install it.

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

- 4f7db37: Changed the default polling interval for `connection.mode: "polling"` from 60 seconds to 5 minutes, and enforced a minimum polling interval of 60 seconds. A configured `pollingInterval` below 60 seconds is raised to 60 seconds and a warning is logged.

## 1.2.0

### Minor Changes

- 41e6f0e: Added a `connectionError` client event and hook that fires when the connection to ConfigDirector fails with an unrecoverable error (for example a revoked SDK key), including when the failure happens after the client was already connected and serving configs. Previously such a post-connection fatal error was silent: the transport stopped reconnecting, the client kept reporting ready, and configs quietly went stale with no way to observe it. The error is now also logged at error level.

### Patch Changes

- 03c1287: Fixed closing the client before it received its first payload leaving `isReady` reporting `true` and firing a spurious `clientReady` event on the closed client. `close()` now also clears the initializing state.
- badf8ae: Fixed a config whose value is legitimately the empty string being treated as missing. `getValue` with a string default now returns `""` (reason `found-match`) instead of falling back to the default with reason `value-missing`. When an empty string cannot satisfy the requested type, the evaluation reason now reflects the actual failure (`invalid-number`, `invalid-boolean`, or `invalid-json`) rather than `value-missing`.
- 6287e8f: Fixed the client `ConfigDirectorProvider` leaking a live browser client (streaming connection and telemetry worker) under React StrictMode in development: the simulated remount unmounted the provider before the client reference reached component state, so the first client was never disposed. The provider now tracks its client on the instance, disposes it reliably on unmount, and no longer updates state from an initialization that finished after unmount.
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
