---
"@configdirector/nuxt-sdk": minor
---

On the server, a context without an `id` now skips percentage rollouts. Server-side rendering and the Nitro server client serve it the default targeting rule value, and the targeting rules after the rollout are not tried. Before, every context without an `id` was served the rollout's first share. Give an anonymous context a stable `id`, such as a session ID, to keep it in a rollout. In the browser nothing changes: a context without an `id` keeps its place in a rollout.
