---
"@configdirector/client-sdk": minor
---

`evaluate` and the `configEvaluated` event now carry `variation`: the `id` and `name` of the variation that was served. It is `undefined` when the config has no variations or the in-code default value is returned, and an unnamed variation has no `name`. The new `Variation` type is exported.

The evaluation counts the SDK sends to ConfigDirector now say which variation was served, and which percentage rollout and share served it, so ConfigDirector can count the contexts each variation of an experiment reached. This holds for values kept on the device as well.

The `EvaluationReason` type gains `rollout-skipped-no-identifier`. Only server SDKs report it, but code that handles every reason exhaustively needs a case for it.
