# @configdirector/config-evaluator-internal

**ConfigDirector internal package.** It exists so that the ConfigDirector dashboard can run the
same targeting rules evaluator the ConfigDirector server SDKs ship, from the same source. It is
not intended for use outside ConfigDirector, carries no compatibility promise, and its API can
change in any release. Applications should use one of the published SDKs instead:
[@configdirector/server-sdk](https://www.npmjs.com/package/@configdirector/server-sdk) for Node,
or a client SDK for the browser and mobile.

The server SDKs in this repository bundle the evaluator from source; nothing in this repository
depends on the published package. The evaluator's behaviour is pinned by the targeting rules
contract, which every ConfigDirector implementation is checked against.

## Contents

- `ConfigEvaluator`: walks a config's targeting rules for a context and returns the served value.
  `explain` returns the value with the trace of how it was reached: each rule's outcome, each
  checked condition with what it resolved to, and the rollout share a context landed in.
  `evaluate` is `explain` with only the value kept, so the two cannot disagree.
- `ConditionEvaluator`: decides whether one condition holds for a context; `explain` also says
  what the condition was compared against.
- `assignPercentage`: the bucketing hash behind percentage rollouts.
- The rule, condition, config and context types the evaluator works on.
- `EVALUATOR_VERSION`: the published version, for showing which evaluator produced a result.

## Versioning

Versioned independently of the SDKs with changesets, starting at 0.1.0. Released with the
"Release @configdirector/config-evaluator-internal" workflow.
