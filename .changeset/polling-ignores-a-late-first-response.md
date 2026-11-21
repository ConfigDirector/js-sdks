---
"@configdirector/client-sdk": patch
"@configdirector/nextjs-sdk": patch
"@configdirector/nuxt-sdk": patch
"@configdirector/openfeature-web-provider": patch
"@configdirector/react-native-sdk": patch
"@configdirector/react-web-sdk": patch
"@configdirector/vue-sdk": patch
---

In polling mode, a response that arrives after a later `updateContext`, `pauseNetwork` or `close()` is now ignored, and polling always sends the latest context. Before, when the context changed before the first response arrived, for example when a user signed in during a slow start, the late response could switch the client back to the previous context: `context`, the values, `contextUpdated` and every poll used it again. After `pauseNetwork`, including when a React Native app went to the background, the late response made the client ready and it polled while paused. After `close()` or `dispose()`, it applied its values and kept polling. Now the call that was waiting for that response returns once its timeout runs out, or as soon as the client is ready again after `resumeNetwork`. In polling and streaming mode alike, an `initialize` or `updateContext` that a later call replaced no longer sets `context` or fires `contextUpdated`; it returns once the later call's values arrive, or at its own timeout. A call that was waiting for its first values when `pauseNetwork` or a later call came no longer waits forever.
