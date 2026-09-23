# @configdirector/config-evaluator-internal

## 0.1.0

### Minor Changes

- 78f5bc3: Added `ConfigEvaluator.explain`, which evaluates a config for a context and returns the served value together with a trace: every rule in the order it was walked with its outcome (matched, not matched, not evaluated, or errored), each condition that was checked with the value it resolved to and that value's shape, and for rollouts the identifier, the assigned percentage, the shares and the one selected. `evaluate` is now defined as this walk with only the value kept. `ConditionEvaluator.explain` exposes the same per-condition detail.
- 2b3b72c: Initial release of the ConfigDirector internal targeting rules evaluator package, so the ConfigDirector dashboard can evaluate rules with the same code the server SDKs bundle. Not intended for use outside ConfigDirector.
