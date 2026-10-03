# @configdirector/config-evaluator-internal

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
