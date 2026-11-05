---
"@configdirector/server-sdk": minor
---

A context without an `id` now skips percentage rollouts. `getValue`, `evaluate`, watchers and `getAllConfigs` serve it the default targeting rule value, and the targeting rules after the rollout are not tried. Before, every context without an `id` was served the rollout's first share. Give an anonymous context a stable `id`, such as a session or device ID, to keep it in a rollout. A rule that serves a single value still applies to a context without an `id`.

Each `getAllConfigs` entry now carries the `variation` (`id` and `name`) of the value served when the config has variations, and the `ruleId` and `shareId` of the percentage rollout that served it.
