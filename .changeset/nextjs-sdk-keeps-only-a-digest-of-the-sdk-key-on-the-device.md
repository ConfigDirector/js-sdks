---
"@configdirector/nextjs-sdk": patch
---

The values the browser half keeps in `localStorage` no longer include the client SDK key, only its SHA-256 digest. Values kept by an earlier version are removed on the first page load after the upgrade, so a page that reads the client directly sees the in-code default values on that load until live values arrive.
