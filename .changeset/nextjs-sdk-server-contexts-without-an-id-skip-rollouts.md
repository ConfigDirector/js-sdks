---
"@configdirector/nextjs-sdk": minor
---

On the server, a context without an `id` now skips percentage rollouts. The server SDK client, `generateSsrConfigSet` and the server `ConfigDirectorProvider` serve it the default targeting rule value, and the targeting rules after the rollout are not tried. The server client's `evaluate` and `configEvaluated` event report it with the new reason `rollout-skipped-no-identifier` and `isDefaultValue: false`. Before, every context without an `id` was served the rollout's first share. Give an anonymous context a stable `id`, such as a session ID, to keep it in a rollout. In the browser this stays as it was: a context without an `id` keeps its place in a rollout.

The server client's `evaluate` and `configEvaluated` event now carry `variation`: the `id` and `name` of the variation that was served. It is `undefined` when the config has no variations or the in-code default value is returned, and an unnamed variation has no `name`. The new `Variation` type is exported from `@configdirector/nextjs-sdk/server`.

Each `generateSsrConfigSet` entry now carries the `variation` (`id` and `name`, with `name: null` for an unnamed variation) of the value served when the config has variations, and the `ruleId` and `shareId` of the percentage rollout that served it.

The evaluation counts the server client sends to ConfigDirector now say which variation was served, and which percentage rollout and share served it, so ConfigDirector can count the contexts each variation of an experiment reached.

In the browser, the client's `evaluate` and `configEvaluated` event carry `variation` too, and the `Variation` type is exported from `@configdirector/nextjs-sdk/client`. The evaluation counts the browser sends to ConfigDirector say which variation was served, and which percentage rollout and share served it, for values kept on the device as well. The browser's `EvaluationReason` type gains `rollout-skipped-no-identifier`: the browser never reports it, but code that handles every reason exhaustively needs a case for it.
