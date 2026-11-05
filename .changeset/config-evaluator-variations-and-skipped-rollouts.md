---
"@configdirector/config-evaluator-internal": minor
---

A context without an identifier now skips a percentage rollout instead of landing in the first share. The default targeting rule value is served and the rules after the rollout are not tried, whether the rollout is a percentage rule or what a matched conditional rule serves. `explain` reports it: the new `reason` is `rollout-skipped-no-identifier` (`found-match` otherwise), the skipped rule's outcome is `rollout-skipped-no-identifier`, and it has no bucket. `BucketExplanation` no longer has `defaultedToPredefinedBucket`, and its `identifier` is always a string.

`ConfigEvaluator.evaluate` now returns the variation of the value it served as `variation` (`id` and `name`), found in the config's `variations` by the `variationId` beside the rule value, the percentage value or the target's `defaultVariationId`, and the `ruleId` and `shareId` of the percentage rollout that served the value. `explain` reports them as `variationId` and `rolloutShare`. A value that is no variation has none, and a value served by a conditional rule's single value or by the default targeting rule has no rule or share. New types: `RolloutShare` and `ServingReason`.
