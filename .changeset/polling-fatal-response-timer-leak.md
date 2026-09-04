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

Fixed the `polling` connection mode leaving its interval timer running after an unrecoverable (4xx) response to a scheduled poll. The transport now closes itself, stopping the useless poll attempts and the repeated warning logs, and `isConnected` correctly reports `false`.
