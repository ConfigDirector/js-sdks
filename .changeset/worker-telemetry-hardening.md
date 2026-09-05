---
"@configdirector/client-sdk": patch
"@configdirector/nextjs-sdk": patch
"@configdirector/nuxt-sdk": patch
"@configdirector/openfeature-web-provider": patch
"@configdirector/react-native-sdk": patch
"@configdirector/react-web-sdk": patch
"@configdirector/vue-sdk": patch
---

Hardened the telemetry web worker integration: closing the client no longer throws in environments without a DOM `document`; and the worker ignores a duplicate initialization message instead of silently starting a second event collector, which split telemetry into separate reports and leaked the first collector's flush timer.
