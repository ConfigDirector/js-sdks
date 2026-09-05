---
"@configdirector/client-sdk": minor
"@configdirector/server-sdk": minor
"@configdirector/react-web-sdk": minor
"@configdirector/react-native-sdk": minor
"@configdirector/vue-sdk": minor
"@configdirector/nextjs-sdk": minor
"@configdirector/nuxt-sdk": minor
"@configdirector/openfeature-web-provider": minor
"@configdirector/openfeature-server-provider": minor
---

Added a `connectionError` client event and hook that fires when the connection to ConfigDirector fails with an unrecoverable error (for example a revoked SDK key), including when the failure happens after the client was already connected and serving configs. Previously such a post-connection fatal error was silent: the transport stopped reconnecting, the client kept reporting ready, and configs quietly went stale with no way to observe it. The error is now also logged at error level.
