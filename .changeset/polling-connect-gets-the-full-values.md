---
"@configdirector/client-sdk": patch
"@configdirector/nextjs-sdk": patch
"@configdirector/nuxt-sdk": patch
"@configdirector/openfeature-web-provider": patch
"@configdirector/react-native-sdk": patch
"@configdirector/react-web-sdk": patch
"@configdirector/vue-sdk": patch
---

In polling mode, `updateContext` now gets the values for the new context, and `resumeNetwork` makes the client ready again. Before, when no config had changed since the client's last values, `updateContext` kept serving the previous context's values, and the client stayed not ready and logged a timeout warning until a config changed. In React Native, the same happened after the app came back to the foreground or got its connection back. Each `initialize`, `updateContext` and `resumeNetwork` in polling mode now downloads the full set of values.
