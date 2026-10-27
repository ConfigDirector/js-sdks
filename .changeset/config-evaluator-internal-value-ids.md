---
"@configdirector/config-evaluator-internal": minor
---

`ConfigEvaluator.evaluate` now returns the value ID of the value it served, read from the config's `defaultValueId`, a rule's `valueId` or a percentage's `valueId`, and `explain` reports it as `valueId`. A config without value IDs gives none.
