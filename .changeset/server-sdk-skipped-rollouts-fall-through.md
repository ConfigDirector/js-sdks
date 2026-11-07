---
"@configdirector/server-sdk": patch
---

A context without an `id` that skips a percentage rollout is now served by the targeting rules after it, as it is after a conditional rule it does not match. Since 1.13.0 the skipped rollout ended the evaluation and the default targeting rule value was served, even when a later rule, such as one on the app version, matched the context. `getValue`, `evaluate`, watchers and `getAllConfigs` serve the later rule's value, with the reason `found-match`; the reason `rollout-skipped-no-identifier` stays for a context served the default targeting rule value after a skipped rollout.
