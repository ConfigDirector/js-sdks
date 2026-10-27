---
"@configdirector/openfeature-server-provider": minor
---

When no config arrives within the connection timeout, initialization now fails: `setProviderAndWait` rejects, and the provider reports the `ERROR` status until config arrives, then `READY`. Before, it reported `READY` while serving in-code default values, then `READY` again once config arrived. To start without waiting for ConfigDirector, call `setProvider` instead, or catch the rejection.
