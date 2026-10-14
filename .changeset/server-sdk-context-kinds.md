---
"@configdirector/server-sdk": minor
---

`ConfigDirectorContext` has a new optional `kind` field that says what kind of entity the context represents, such as `device`, `organization` or `tenant`; leaving it out means `user`. A kind has 1 to 64 characters, using only lowercase letters, digits, `-` and `_`, and is used exactly as given. Targeting rules and segments can match on a context's kind, and percentage rollouts give contexts of other kinds their own assignments while `user` contexts keep the ones they have today. A context with an invalid kind never makes the SDK throw: `getValue`, watchers and `getAllConfigs` evaluate exactly as if no context had been supplied, and the `configEvaluated` event carries no context. The SDK logs an error for each distinct invalid kind once per telemetry flush interval, and the test client logs every such read. ConfigDirector receives a count of these reads with a sample of each invalid kind, never the context's identifier, name or traits.
