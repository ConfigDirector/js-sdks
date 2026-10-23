---
"@configdirector/nuxt-sdk": minor
---

The browser client keeps the last values it received from ConfigDirector in `localStorage` and serves them on the next page load of the same context until live values arrive, with the new evaluation reason `cached`, so a hydration that times out renders the last live values instead of the in-code default values. The entry lives under a key derived from the client SDK key with a size limit of 256 KB, and nothing is kept in `offline` mode. The module takes no option to turn this off yet.
