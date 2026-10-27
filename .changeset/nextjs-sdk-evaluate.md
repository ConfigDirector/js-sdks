---
"@configdirector/nextjs-sdk": minor
---

Added `evaluate(key, defaultValue)`, which returns the value together with the reason it was served and its value ID, the same evaluation that `configEvaluated` reports. The `ConfigEvaluation` and `EvaluationReason` types are exported.

Added `evaluate(key, defaultValue, context)`, which returns the value together with the reason it was served and its value ID, the same evaluation that `configEvaluated` reports. The `ConfigEvaluation` and `EvaluationReason` types are exported. Evaluations now carry the value ID ConfigDirector assigned to the value served.
