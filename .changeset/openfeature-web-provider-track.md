---
"@configdirector/openfeature-web-provider": minor
---

The provider now implements OpenFeature's tracking. `client.track(eventName, details?)` reports to ConfigDirector that something happened, such as a completed checkout, so ConfigDirector can show it on the live feed and count it for each variation of a running experiment. Before, a `track` call did nothing. `details.value` is sent as the event's value and the other keys of `details` as the event's details. The event is reported for the context the provider last received from OpenFeature, with its `targetingKey` (or `id`) and `kind`.

An event counts for an experiment only when that context has the `targetingKey` the experiment's flag was evaluated with. Without one, the event is still reported. The `targetingKey` of a context marked `anonymous` is not sent.

Tracked events are sent with the next telemetry batch, at most 1,000 per batch; events beyond that are not reported. An event whose name does not have 1 to 150 characters is not reported. Details with more than 20 top-level keys or larger than 1 KB as JSON, and a `value` that is not a finite number, are left out and the event is still reported. Each of these logs one warning per telemetry batch. `track` does nothing in `offline` mode.

A telemetry report larger than 32 KB is now sent as an ordinary request instead of a `keepalive` one. Browsers refuse `keepalive` requests beyond 64 KB, and a refused report used to stop the SDK's reporting for the rest of the page's life. A report that large may not complete if the page closes while it is being sent.
