---
"@configdirector/client-sdk": patch
"@configdirector/server-sdk": patch
"@configdirector/nextjs-sdk": patch
"@configdirector/nuxt-sdk": patch
"@configdirector/openfeature-server-provider": patch
"@configdirector/openfeature-web-provider": patch
"@configdirector/react-native-sdk": patch
"@configdirector/react-web-sdk": patch
"@configdirector/vue-sdk": patch
---

Hardened the telemetry flush loop: an unexpected error thrown during a flush no longer kills telemetry collection permanently with an unhandled promise rejection — it is logged and the next flush is scheduled as usual. A flush already in flight when the client is closed no longer re-arms the flush timer after close, and concurrent flush triggers no longer stack multiple parallel flush timers. Closing the client now always completes cleanup even if the final flush attempt fails.
