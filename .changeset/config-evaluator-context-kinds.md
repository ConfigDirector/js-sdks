---
"@configdirector/config-evaluator-internal": minor
---

Added context kinds. The context passed to `ConfigEvaluator.evaluate`, `ConfigEvaluator.explain` and `ConditionEvaluator` can carry a `kind`. A context without one, and an evaluation without a context, have the kind `user`. A condition on the `kind` attribute compares that kind like any other text condition, and its explanation reports the kind as the resolved value. A percentage rollout assigns a context of any kind other than `user` from its identifier, the config id and its kind, so a device and a user with the same identifier can land in different shares. A `user` context keeps the share it had before, and a context without an identifier still lands in the first share. `assignPercentage` now requires the context kind as `contextKind`.
