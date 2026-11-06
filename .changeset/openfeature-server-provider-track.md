---
"@configdirector/openfeature-server-provider": minor
---

The provider now implements OpenFeature's tracking. `client.track(eventName, context?, details?)` reports to ConfigDirector that something happened, such as a completed checkout, so ConfigDirector can show it on the live feed and count it for each variation of a running experiment. Before, a `track` call did nothing. `details.value` is sent as the event's value, the other keys of `details` as the event's details, and the `targetingKey` (or `id`) and `kind` of the merged evaluation context as the context the event happened for.

An event counts for an experiment only when its evaluation context has the `targetingKey` the experiment's flag was evaluated with. Without one, the event is still reported. The `targetingKey` of a context marked `anonymous` is not sent.

Tracked events are sent with the next telemetry batch, at most 1,000 per batch; events beyond that are not reported. An event whose name does not have 1 to 150 characters is not reported. Details with more than 20 top-level keys or larger than 1 KB as JSON, and a `value` that is not a finite number, are left out and the event is still reported. Each of these logs one warning per telemetry batch. `track` does nothing in `offline` mode.
