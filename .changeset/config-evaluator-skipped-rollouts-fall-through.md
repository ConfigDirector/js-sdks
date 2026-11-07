---
"@configdirector/config-evaluator-internal": patch
---

A percentage rollout skipped for a context without an identifier no longer ends the walk: the rules after it are tried, as after a conditional rule whose conditions do not match. `explain` reports the skipped rule with the outcome `rollout-skipped-no-identifier` and the rules after it with their own outcomes; `not-evaluated` is left for the rules after the one that served the value. The reason `rollout-skipped-no-identifier` is reported only when the default targeting rule value is served after a skipped rollout; a later rule that applies serves with the reason `found-match`.
