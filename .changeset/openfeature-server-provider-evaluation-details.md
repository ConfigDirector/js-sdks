---
"@configdirector/openfeature-server-provider": minor
---

Evaluation details now carry the reason, the variant, and an error code when an error made the provider serve the in-code default value: `FLAG_NOT_FOUND` for a config that does not exist, `TYPE_MISMATCH` for a value of another type, and `PROVIDER_NOT_READY` before values arrive. OpenFeature error hooks now run in these cases.
