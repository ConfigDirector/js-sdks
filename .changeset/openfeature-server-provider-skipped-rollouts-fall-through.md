---
"@configdirector/openfeature-server-provider": patch
---

An evaluation context with neither a `targetingKey` nor an `id` that skips a percentage rollout is now resolved by the targeting rules after it, as it is after a conditional rule it does not match. Since 1.13.0 the skipped rollout ended the evaluation and the flag resolved to the default targeting rule value, even when a later rule matched the context. A later rule that applies resolves with the reason `TARGETING_MATCH`; `DEFAULT` stays for a context resolved to the default targeting rule value after a skipped rollout.
