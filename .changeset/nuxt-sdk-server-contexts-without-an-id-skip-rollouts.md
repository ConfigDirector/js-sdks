---
"@configdirector/nuxt-sdk": minor
---

On the server, a context without an `id` now skips percentage rollouts. Server-side rendering and the Nitro server client serve it the default targeting rule value, and the targeting rules after the rollout are not tried. On the server, `evaluate` and the `configEvaluated` hook report it with the new reason `rollout-skipped-no-identifier` and `isDefaultValue: false`. Before, every context without an `id` was served the rollout's first share. Give an anonymous context a stable `id`, such as a session ID, to keep it in a rollout. In the browser this stays as it was: a context without an `id` keeps its place in a rollout.

On the server, `evaluate` and the `configEvaluated` hook now carry `variation`: the `id` and `name` of the variation that was served. It is `undefined` when the config has no variations or the in-code default value is returned, and an unnamed variation has no `name`. The new `Variation` type is exported.

The evaluation counts the server sends to ConfigDirector now say which variation was served, and which percentage rollout and share served it, so ConfigDirector can count the contexts each variation of an experiment reached.

In the browser, `evaluate` and the `configEvaluated` hook carry `variation` too. The evaluation counts the browser sends to ConfigDirector say which variation was served, and which percentage rollout and share served it, for values kept on the device as well. The browser never reports the reason `rollout-skipped-no-identifier`, but code that handles every `EvaluationReason` exhaustively needs a case for it.
