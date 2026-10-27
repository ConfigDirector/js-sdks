---
"@configdirector/client-sdk": patch
---

The values kept on the device, in `localStorage` or in a `CachingProvider` of your own, no longer include the client SDK key, only its SHA-256 digest. Values kept by an earlier version are removed on the first launch after the upgrade, so that launch serves the in-code default values until live values arrive. On a page without `crypto.subtle`, such as a plain `http` page on a host other than `localhost`, a `CachingProvider` of your own is no longer called and nothing is kept, as the default store already kept nothing there.
