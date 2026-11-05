---
"@configdirector/openfeature-server-provider": minor
---

An evaluation context with neither a `targetingKey` nor an `id` now skips percentage rollouts. The flag resolves to the default targeting rule value, and the targeting rules after the rollout are not tried. Before, every such context was served the rollout's first share. Give an anonymous context a stable `targetingKey`, such as a session ID, to keep it in a rollout. A rule that serves a single value still applies to a context without one.
