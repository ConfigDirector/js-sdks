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

Fixed the `polling` and `one-time` connection modes permanently stopping after a transient network failure. A thrown network error (device offline, DNS failure, connection reset) is now treated as retryable and polling resumes on the next interval, matching how streaming mode already behaved. Only 4xx responses and permission errors remain unrecoverable.
