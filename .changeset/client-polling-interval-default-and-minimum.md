---
"@configdirector/client-sdk": minor
"@configdirector/openfeature-web-provider": minor
"@configdirector/react-web-sdk": minor
"@configdirector/vue-sdk": minor
"@configdirector/react-native-sdk": minor
"@configdirector/nextjs-sdk": minor
"@configdirector/nuxt-sdk": minor
---

The client-side polling interval for `connection.mode: "polling"` now defaults to 60 seconds (previously 5 minutes) and has a minimum of 30 seconds (previously 60 seconds). A configured `pollingInterval` below the minimum is raised to the minimum and a single warning is logged when the client is created; the interval is never rejected. In `streaming` mode the interval has no effect and nothing is logged.
