---
"@configdirector/nextjs-sdk": minor
---

On the server, `ConfigDirectorContext` has a new optional `kind` field that says what kind of entity the context represents, such as `device`, `organization` or `tenant`; leaving it out means `user`. The server SDK client, `generateSsrConfigSet` and the server `ConfigDirectorProvider` evaluate targeting rules on it. A kind has 1 to 64 characters, using only lowercase letters, digits, `-` and `_`. A context with any other kind never makes them throw: they evaluate exactly as if no context had been supplied and log an error for each distinct invalid kind once per telemetry flush interval, and the server test client logs every such read.
