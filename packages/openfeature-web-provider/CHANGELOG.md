# @configdirector/openfeature-web-provider

## 1.10.0

### Minor Changes

- 7a328c3: Evaluation details now carry the reason, the variant, and an error code when an error made the provider serve the in-code default value: `FLAG_NOT_FOUND` for a config that does not exist, `TYPE_MISMATCH` for a value of another type, and `PROVIDER_NOT_READY` before values arrive. Values kept on the device report the `CACHED` reason. OpenFeature error hooks now run in these cases.

### Patch Changes

- f305d86: A JSON config read with an object as its in-code default value now gives the config's value only when that value is a JSON object, and one read with an array as its in-code default value only when the value is a JSON array. Before, a JSON array reached a read with an object, and a JSON object a read with an array. Such a read now gives the in-code default value with the reason `type-mismatch`, or the error code `TYPE_MISMATCH` through the OpenFeature providers. It is reported to ConfigDirector, so the dashboard shows the Config type mismatch alert for the config, as it does for other mismatches.
- 399ee39: The values kept on the device, in `localStorage` or in a `CachingProvider` of your own, no longer include the client SDK key, only its SHA-256 digest. Values kept by an earlier version are removed on the first launch after the upgrade, so that launch resolves flags to the default values passed to the OpenFeature client until live values arrive. On a page without `crypto.subtle`, such as a plain `http` page on a host other than `localhost`, a `CachingProvider` of your own is no longer called and nothing is kept, as the default store already kept nothing there.
- 437fc57: OpenFeature events, hooks and logs now show the provider's name, `ConfigDirectorProvider`, where they showed a minified name such as `r`: the `providerName` of provider events, `providerMetadata.name` in a hook's context, and OpenFeature's own log messages.

## 1.9.1

### Patch Changes

- 7dab866: The SDK now sends its instance ID with telemetry, the same ID it connects with, so ConfigDirector can tell which browser the telemetry came from.

## 1.9.0

### Minor Changes

- a8456cf: The instance ID the SDK stores in the browser's `localStorage` now lasts until the site's data is cleared, instead of being replaced six hours after it was created, so an anonymous visitor counts as one monthly active user a month. An instance ID stored by an earlier version of the SDK is kept.
- e80c752: The provider keeps the last values it received from ConfigDirector in the browser's `localStorage` and serves them on the next launch of the same context until live values arrive, so an application opened without a network resolves flags to the values ConfigDirector last sent instead of the default values passed to the OpenFeature client. `setProviderAndWait` still rejects with `ProviderNotReadyError` on a timeout; the provider then reports the `STALE` status, with a `Stale` event, while it serves the kept values, and `READY` once live values arrive. A context change that cannot connect reports an error and then `STALE` again. Resolution details still carry no reason. The new `caching` option of the provider's constructor turns this off with `enabled: false` or replaces the store with a `CachingProvider` of your own (`read`, `write`, `remove` and `sizeLimit` in bytes), both exported as types; the default store keeps the entry under a key derived from the client SDK key with a size limit of 256 KB, above which nothing is kept. Nothing is kept in `offline` mode.

## 1.8.0

### Minor Changes

- 9affaaa: The provider runs in `offline` mode through the client options it already takes: `connection: { mode: "offline", values }` serves those values to every evaluation without connecting to ConfigDirector or sending anything. An offline provider needs no client SDK key, so `new ConfigDirectorProvider({ connection: { mode: "offline", values } })` takes the options alone. Registering an offline provider whose values cannot be loaded fails with a `ConfigDirectorInitializationError`, which the package exports along with the `OfflineValues`, `OfflineValue` and `OfflineClientOptions` types.

## 1.7.0

### Minor Changes

- 7ea20eb: The provider reads a top-level `kind` field from the evaluation context, beside `targetingKey`, as the ConfigDirector context kind, for example `{ targetingKey: "42", kind: "device" }`; leaving it out means `user`. A `kind` inside `traits` stays an ordinary trait. A kind must have 1 to 64 characters, using only lowercase letters, digits, `-` and `_`. With any other kind, including one that is not a string, the whole context is ignored: initialization and context changes still succeed, flags resolve to the values for no context, and the SDK logs an error.

## 1.6.1

### Patch Changes

- 11bd406: A telemetry failure while recording a context update or while closing the client is now logged as a warning instead of surfacing as an unhandled promise rejection.
- 11bd406: When Web Workers are unavailable, the browser client now turns telemetry off and logs a single warning saying why, instead of leaving an unhandled promise rejection (`ReferenceError: Worker is not defined`) after its first successful connection. This happens in DOM test environments such as jsdom and happy-dom, where the rejection failed Vitest runs even when every test passed, and wherever constructing the worker throws. The client otherwise behaves as before: `initialize` resolves, the client becomes ready, and configs are served normally.

## 1.6.0

### Minor Changes

- 0cd0087: The client-side polling interval for `connection.mode: "polling"` now defaults to 60 seconds (previously 5 minutes) and has a minimum of 30 seconds (previously 60 seconds). A configured `pollingInterval` below the minimum is raised to the minimum and a single warning is logged when the client is created; the interval is never rejected. In `streaming` mode the interval has no effect and nothing is logged.
- eeef332: A config whose served value is an empty string now evaluates to the default value with the `value-missing` reason, for every config type and every requested type, as the other ConfigDirector SDKs already do. Previously a string, JSON, or enum config holding an empty string was served as `""` when read as a string, and other reads reported `invalid-number`, `invalid-boolean`, or `invalid-json`. An application that relied on receiving `""` should read the config with `""` as its default value.
- eeef332: `isInitializing` now means the client is trying to get its very first payload. It becomes `true` when `initialize` is called on a client that has never received a payload, stays `true` through timeouts and retries, and becomes `false` when the first payload arrives, when a fatal connection error stops the retries, or on `close`. Previously it stayed `true` forever after a fatal connection error, which kept the Vue plugin from initializing that client again, and it was also set by an `initialize` call on a client that already had a payload. `updateContext` and `resumeNetwork` never set it.
- 67cdcf6: The client now reports configs that a full update from the server no longer includes. The `configsUpdated` event has a new `removedKeys` property listing them, and `keys` still lists only the configs the update included. The `watch` callbacks of a removed config are called with their default value. Previously a removed config silently stopped being served, and its watchers kept acting on the last value they were sent. The OpenFeature providers include removed keys in the `flagsChanged` list of `PROVIDER_CONFIGURATION_CHANGED`.
- eeef332: Client telemetry now starts with the client's first connection instead of when the client is constructed. In the browser the telemetry worker is created on the first successful `initialize`, and in React Native the flush timer starts then. A client that is only constructed and never initialized, such as the discarded instance React StrictMode creates, holds no worker or timer. Evaluations recorded before the first connection are kept, up to the telemetry queue limit, and reported once telemetry starts.

### Patch Changes

- 94866bf: A context change no longer emits `PROVIDER_STALE`. The OpenFeature web SDK already puts the provider in the `RECONCILING` status and emits `PROVIDER_RECONCILING` while the provider's context change handler runs, as the OpenFeature specification expects, so handlers for `PROVIDER_STALE` are no longer called on `setContext`.

## 1.5.1

### Patch Changes

- Fixed telemetry reporter to include appName and appVersion with telemetry data to support activity graphs.

## 1.5.0

### Minor Changes

- A boolean, integer, or float config requested as a string now evaluates to the default value with the `type-mismatch` reason, instead of the value's text with `found-match`, so the mistake reaches ConfigDirector's type-mismatch alert. Reading a JSON config as a string still returns its raw document.

## 1.4.1

### Patch Changes

- 3d3ff18: The provider now reports when ConfigDirector could not be reached in time. When no config state arrives within `connection.timeout`, `initialize` rejects with a `ProviderNotReadyError`, so `OpenFeature.setProviderAndWait` rejects and the provider's status is `ERROR` instead of `READY`; a context change that times out sets the same status. The underlying client keeps trying to connect, and the provider emits `PROVIDER_READY` as soon as config state arrives. Until then flags resolve to the config state received earlier, or to their default values when there is none. Previously the provider reported `READY` while serving default values. A successful context change no longer emits a redundant `PROVIDER_READY` after the SDK's own `PROVIDER_CONTEXT_CHANGED`.

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
