---
"@configdirector/openfeature-server-provider": minor
---

The `variant` in evaluation details is now the variation's name when the config has variations and the variation served has a name, such as `treatment`. Before, it was always the value ID. It stays the value ID for a config without variations and for an unnamed variation. If you send `variant` to an analytics tool, an experiment's evaluations now show up under the variation names.

An evaluation context with neither a `targetingKey` nor an `id` now skips percentage rollouts. The flag resolves to the default targeting rule value with the reason `DEFAULT`, and the targeting rules after the rollout are not tried. Before, every such context was served the rollout's first share. Give an anonymous context a stable `targetingKey`, such as a session ID, to keep it in a rollout. A rule that serves a single value still applies to a context without one.

The evaluation counts the provider sends to ConfigDirector now say which variation was served, and which percentage rollout and share served it, so ConfigDirector can count the contexts each variation of an experiment reached.
