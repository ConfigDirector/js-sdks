---
"@configdirector/client-sdk": patch
"@configdirector/nextjs-sdk": patch
"@configdirector/nuxt-sdk": patch
"@configdirector/openfeature-web-provider": patch
"@configdirector/react-web-sdk": patch
"@configdirector/vue-sdk": patch
---

The SDK now sends its instance ID with telemetry, the same ID it connects with, so ConfigDirector can tell which browser the telemetry came from.
