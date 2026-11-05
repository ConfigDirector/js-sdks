---
"@configdirector/nuxt-sdk": minor
---

On the server, a context without an `id` now skips percentage rollouts. Server-side rendering and the Nitro server client serve it the default targeting rule value, and the targeting rules after the rollout are not tried. On the server, `evaluate` and the `configEvaluated` hook report it with the new reason `rollout-skipped-no-identifier` and `isDefaultValue: false`. Before, every context without an `id` was served the rollout's first share. Give an anonymous context a stable `id`, such as a session ID, to keep it in a rollout. In the browser nothing changes: a context without an `id` keeps its place in a rollout.

On the server, `evaluate` and the `configEvaluated` hook now carry `variation`: the `id` and `name` of the variation that was served. It is `undefined` when the config has no variations or the in-code default value is returned, and an unnamed variation has no `name`. The new `Variation` type is exported.

The evaluation counts the server sends to ConfigDirector now say which variation was served, and which percentage rollout and share served it, so ConfigDirector can count the contexts each variation of an experiment reached.
