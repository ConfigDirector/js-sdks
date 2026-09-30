---
"@configdirector/server-sdk": patch
"@configdirector/nuxt-sdk": patch
---

The Node.js server SDK no longer keeps the event loop alive after it has stopped mattering. The timers that bound `initialize` and the streaming connection are cleared as soon as they settle, the telemetry flush timer starts with the first `initialize` instead of when the client is constructed, and the streaming heartbeat stops after a fatal connection error. `dispose()` now also ends a pending `initialize`, which resolves promptly without marking the client ready or emitting `clientReady`. The Nuxt module's `useConfigDirectorContext` clears the timer that bounds `updateContext` the same way.
