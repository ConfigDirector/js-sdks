---
"@configdirector/server-sdk": minor
---

A context without an `id` now skips percentage rollouts. `getValue`, `evaluate`, watchers and `getAllConfigs` serve it the default targeting rule value, and the targeting rules after the rollout are not tried. `evaluate` and the `configEvaluated` event report it with the new reason `rollout-skipped-no-identifier` and `isDefaultValue: false`. Before, every context without an `id` was served the rollout's first share. Give an anonymous context a stable `id`, such as a session or device ID, to keep it in a rollout. A rule that serves a single value still applies to a context without an `id`.

`evaluate` and the `configEvaluated` event now carry `variation`: the `id` and `name` of the variation that was served. It is `undefined` when the config has no variations or the in-code default value is returned, and an unnamed variation has no `name`. The new `Variation` type is exported.

Each `getAllConfigs` entry now carries the `variation` (`id` and `name`, with `name: null` for an unnamed variation) of the value served when the config has variations, and the `ruleId` and `shareId` of the percentage rollout that served it.

The evaluation counts the SDK sends to ConfigDirector now say which variation was served, and which percentage rollout and share served it, so ConfigDirector can count the contexts each variation of an experiment reached.
