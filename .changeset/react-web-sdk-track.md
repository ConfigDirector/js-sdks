---
"@configdirector/react-web-sdk": minor
---

The client from `useClient()` has a new `track(eventName, options?)` method that reports to ConfigDirector that something happened for the current context, such as a completed checkout, so ConfigDirector can show it on the live feed and count it for each variation of a running experiment. `options` takes a `value`, a number of any kind such as an amount of money, a count or a duration, and `details`, an object whose values are strings, numbers, booleans, or nested objects and arrays. The new `TrackOptions`, `TrackedEventDetails` and `TrackedEventDetailValue` types are exported.

An event counts for an experiment only when the client's context has an `id`, the one the experiment's config was evaluated for. Before the client has a context, or for a context without an `id`, the event is still reported. The `id` of a context marked `anonymous` is not sent.

Tracked events are sent with the next telemetry batch, at most 1,000 per batch; events beyond that are not reported. An event whose name does not have 1 to 150 characters is not reported. Details with more than 20 top-level keys or larger than 1 KB as JSON, and a `value` that is not a finite number, are left out and the event is still reported. Each of these logs one warning per telemetry batch. `track` never throws, and does nothing in `offline` mode.

The test client from `@configdirector/react-web-sdk/testing` records the events the code under test tracked in `testClient.trackedEvents`, in call order, as `{ name, context?, value?, details? }`. An event whose name the SDK would not report is not recorded, and a value or details the SDK would leave out are missing from the record. The limit of 1,000 events per telemetry batch does not apply to the record. The new `TrackedEvent` type is exported from the testing entry point.

A telemetry report larger than 32 KB is now sent as an ordinary request instead of a `keepalive` one. Browsers refuse `keepalive` requests beyond 64 KB, and a refused report used to stop the SDK's reporting for the rest of the page's life. A report that large may not complete if the page closes while it is being sent.
