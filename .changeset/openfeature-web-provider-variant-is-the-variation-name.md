---
"@configdirector/openfeature-web-provider": minor
---

The `variant` in evaluation details is now the variation's name when the config has variations and the variation served has a name, such as `treatment`. Before, it was always the value ID. It stays the value ID for a config without variations and for an unnamed variation. If you send `variant` to an analytics tool, an experiment's evaluations now show up under the variation names.

The evaluation counts the provider sends to ConfigDirector now say which variation was served, and which percentage rollout and share served it, so ConfigDirector can count the contexts each variation of an experiment reached. This holds for values kept on the device as well.
