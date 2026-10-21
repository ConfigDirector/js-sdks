---
"@configdirector/nuxt-sdk": patch
---

`useConfigDirectorServerClient()` and `useConfigDirectorServerHooks()` throw an `Error` with the message "The ConfigDirector Nitro plugin was not initialized" when the ConfigDirector Nitro plugin has not run. Before, `useConfigDirectorServerClient()` threw a plain string, so code that read `error.message` got `undefined`.
