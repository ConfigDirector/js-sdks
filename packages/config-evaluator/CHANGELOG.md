# @configdirector/config-evaluator-internal

## 0.6.1

### Patch Changes

- 073bbdc: A percentage rollout skipped for a context without an identifier no longer ends the walk: the rules after it are tried, as after a conditional rule whose conditions do not match. `explain` reports the skipped rule with the outcome `rollout-skipped-no-identifier` and the rules after it with their own outcomes; `not-evaluated` is left for the rules after the one that served the value. The reason `rollout-skipped-no-identifier` is reported only when the default targeting rule value is served after a skipped rollout; a later rule that applies serves with the reason `found-match`.

## 0.6.0

### Minor Changes

- 237c380: A context without an identifier now skips a percentage rollout instead of landing in the first share. The default targeting rule value is served and the rules after the rollout are not tried, whether the rollout is a percentage rule or what a matched conditional rule serves. `explain` reports it: the new `reason` is `rollout-skipped-no-identifier` (`found-match` otherwise), the skipped rule's outcome is `rollout-skipped-no-identifier`, and it has no bucket. `BucketExplanation` no longer has `defaultedToPredefinedBucket`, and its `identifier` is always a string.

  `ConfigEvaluator.evaluate` now returns the variation of the value it served as `variation` (`id` and `name`), found in the config's `variations` by the `variationId` beside the rule value, the percentage value or the target's `defaultVariationId`, and the `ruleId` and `shareId` of the percentage rollout that served the value. `explain` reports them as `variationId` and `rolloutShare`. A value that is no variation has none, and a value served by a conditional rule's single value or by the default targeting rule has no rule or share. New types: `RolloutShare` and `ServingReason`.

## 0.5.0

### Minor Changes

- 7a328c3: `ConfigEvaluator.evaluate` now returns the value ID of the value it served, read from the config's `defaultValueId`, a rule's `valueId` or a percentage's `valueId`, and `explain` reports it as `valueId`. A config without value IDs gives none.

## 0.4.0

### Minor Changes

- 5ec5a3f: Added context kinds. The context passed to `ConfigEvaluator.evaluate`, `ConfigEvaluator.explain` and `ConditionEvaluator` can carry a `kind`. A context without one, and an evaluation without a context, have the kind `user`. A condition on the `kind` attribute compares that kind like any other text condition, and its explanation reports the kind as the resolved value. A percentage rollout assigns a context of any kind other than `user` from its identifier, the config id and its kind, so a device and a user with the same identifier can land in different shares. A `user` context keeps the share it had before, and a context without an identifier still lands in the first share. `assignPercentage` now requires the context kind as `contextKind`.

## 0.3.0

### Minor Changes

- Added segment evaluation. `ConfigEvaluator.evaluate` and `ConfigEvaluator.explain` take the payload's `segments` map as a third argument, and a rule's conditions may now be segment conditions (`kind: "segment"`, operator `in` or `not in`, `segmentId`) beside attribute conditions, which carry `kind: "attribute"` or no `kind`. A context is in a segment when any of its condition groups matches, a group matches when every condition in it matches, and a segment the map does not hold matches nothing for either operator. The condition explanation now carries its `kind`: a segment condition's explanation says whether the segment was found and which group matched. New types: `AttributeCondition`, `SegmentCondition`, `SegmentOperator`, `ConditionGroup`, `Segment`, `Segments`, and the `SegmentOperatorList` constant.

## 0.2.1

### Patch Changes

- 3794556: Trait pointers in targeting rules now follow RFC 6901 exactly. A pointer that does not start with `/` no longer resolves by dropping its first character, and a pointer with an escape other than `~0` or `~1` no longer resolves to a member named with the literal text; both now resolve to a missing trait. The SDKs no longer depend on `@jsonjoy.com/json-pointer`, whose packages require `tslib` without declaring it as a dependency, so the SDKs failed to load with `Cannot find module 'tslib'` in Yarn projects that did not otherwise install it.

## 0.2.0

### Minor Changes

- Default percentage rollouts to the first bucket when there is no context identifier on server evaluations.

## 0.1.0

### Minor Changes

- 78f5bc3: Added `ConfigEvaluator.explain`, which evaluates a config for a context and returns the served value together with a trace: every rule in the order it was walked with its outcome (matched, not matched, not evaluated, or errored), each condition that was checked with the value it resolved to and that value's shape, and for rollouts the identifier, the assigned percentage, the shares and the one selected. `evaluate` is now defined as this walk with only the value kept. `ConditionEvaluator.explain` exposes the same per-condition detail.
- 2b3b72c: Initial release of the ConfigDirector internal targeting rules evaluator package, so the ConfigDirector dashboard can evaluate rules with the same code the server SDKs bundle. Not intended for use outside ConfigDirector.
