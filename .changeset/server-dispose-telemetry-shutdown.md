---
"@configdirector/server-sdk": patch
"@configdirector/nextjs-sdk": patch
"@configdirector/nuxt-sdk": patch
"@configdirector/openfeature-server-provider": patch
---

Fixed `dispose()` on the server client leaving the telemetry flush timer running, which kept the Node.js event loop alive indefinitely and prevented graceful process shutdown. Disposing the client now stops telemetry collection and flushes any pending telemetry events in the background.
