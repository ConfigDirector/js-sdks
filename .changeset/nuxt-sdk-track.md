---
"@configdirector/nuxt-sdk": minor
---

On the server, the client from `useConfigDirectorServerClient()` has a new `track(eventName, context?, options?)` method that reports to ConfigDirector that something happened, such as a completed checkout, so ConfigDirector can show it on the live feed and count it for each variation of a running experiment. `options` takes a `value`, a number of any kind such as an amount of money, a count or a duration, and `details`, an object whose values are strings, numbers, booleans, or nested objects and arrays. The new `TrackOptions`, `TrackedEventDetails` and `TrackedEventDetailValue` types are exported.

An event counts for an experiment only when it is tracked for a context with an `id`, the one the experiment's config was evaluated for. Without a context, or for a context without an `id`, the event is still reported. The `id` of a context marked `anonymous` is not sent.

Tracked events are sent with the next telemetry batch, at most 1,000 per batch; events beyond that are not reported. An event whose name does not have 1 to 150 characters is not reported. Details with more than 20 top-level keys or larger than 1 KB as JSON, and a `value` that is not a finite number, are left out and the event is still reported. Each of these logs one warning per telemetry batch. `track` never throws, and does nothing in `offline` mode.

In the app, the client from `useConfigDirectorClient()` has a new `track(eventName, options?)` method that reports the event for the client's current context, with the same `options`, limits and warnings. An event counts for an experiment only when that context has an `id`; before the client has a context, or for a context without an `id`, the event is still reported. During server rendering the same call reports the event through the server client for the request's context, so code that tracks while rendering reports once on the server and once more in the browser.

The test client from `@configdirector/nuxt-sdk/testing` records the events the code under test tracked in `testClient.trackedEvents`, in call order, as `{ name, context?, value?, details? }`. An event whose name the SDK would not report is not recorded, and a value or details the SDK would leave out are missing from the record. The limit of 1,000 events per telemetry batch does not apply to the record. The new `TrackedEvent` type is exported from the testing entry point.

In the browser, a telemetry report larger than 32 KB is now sent as an ordinary request instead of a `keepalive` one. Browsers refuse `keepalive` requests beyond 64 KB, and a refused report used to stop the SDK's reporting for the rest of the page's life. A report that large may not complete if the page closes while it is being sent.
