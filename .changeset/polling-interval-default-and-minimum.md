---
"@configdirector/client-sdk": minor
"@configdirector/nextjs-sdk": minor
"@configdirector/nuxt-sdk": minor
"@configdirector/openfeature-web-provider": minor
"@configdirector/react-native-sdk": minor
"@configdirector/react-web-sdk": minor
"@configdirector/vue-sdk": minor
---

Changed the default polling interval for `connection.mode: "polling"` from 60 seconds to 5 minutes, and enforced a minimum polling interval of 60 seconds. A configured `pollingInterval` below 60 seconds is raised to 60 seconds and a warning is logged.
