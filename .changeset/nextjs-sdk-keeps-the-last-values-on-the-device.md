---
"@configdirector/nextjs-sdk": minor
---

The browser half keeps the last values it received from ConfigDirector in `localStorage` and serves them on the next page load of the same context until live values arrive, with the new evaluation reason `cached`; the hooks keep showing the server-rendered values until the client is ready, as before, so a page sees this only where it reads the client directly. The entry lives under a key derived from the client SDK key with a size limit of 256 KB, and nothing is kept in `offline` mode. The client provider takes no option to turn this off yet.
