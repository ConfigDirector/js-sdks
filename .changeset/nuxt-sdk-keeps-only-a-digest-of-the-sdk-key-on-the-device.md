---
"@configdirector/nuxt-sdk": patch
---

The values the browser client keeps in `localStorage` no longer include the client SDK key, only its SHA-256 digest. Values kept by an earlier version are removed on the first page load after the upgrade, so a hydration that times out on that load renders the in-code default values instead of the last live values.
