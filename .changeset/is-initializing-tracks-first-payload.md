---
"@configdirector/client-sdk": minor
"@configdirector/react-web-sdk": minor
"@configdirector/vue-sdk": minor
"@configdirector/react-native-sdk": minor
"@configdirector/nextjs-sdk": minor
"@configdirector/nuxt-sdk": minor
"@configdirector/openfeature-web-provider": minor
---

`isInitializing` now means the client is trying to get its very first payload. It becomes `true` when `initialize` is called on a client that has never received a payload, stays `true` through timeouts and retries, and becomes `false` when the first payload arrives, when a fatal connection error stops the retries, or on `close`. Previously it stayed `true` forever after a fatal connection error, which kept the Vue plugin from initializing that client again, and it was also set by an `initialize` call on a client that already had a payload. `updateContext` and `resumeNetwork` never set it.
