---
"@configdirector/nuxt-sdk": minor
---

`ConfigDirectorContext` has a new optional `kind` field that says what kind of entity the context represents, such as `device`, `organization` or `tenant`; leaving it out means `user`. Server-side rendering and the Nitro server client evaluate targeting rules on it. A kind has 1 to 64 characters, using only lowercase letters, digits, `-` and `_`. With any other kind, server-side rendering evaluates exactly as if no context had been supplied, the SSR client's `context` reads as no context, and the server logs an error for each distinct invalid kind once per telemetry flush interval.
