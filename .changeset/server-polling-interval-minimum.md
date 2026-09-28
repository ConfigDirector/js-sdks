---
"@configdirector/server-sdk": minor
"@configdirector/openfeature-server-provider": minor
"@configdirector/nextjs-sdk": minor
"@configdirector/nuxt-sdk": minor
---

The server-side polling interval for `connection.mode: "polling"` keeps its default of 300 seconds (5 minutes) and now has a minimum of 60 seconds. A configured `pollingInterval` below the minimum is raised to the minimum and a single warning is logged when the client is created; the interval is never rejected. In `streaming` mode the interval has no effect and nothing is logged. The `pollingInterval` option documentation, which wrongly stated a default of 60 seconds, now states the actual default and the minimum.
