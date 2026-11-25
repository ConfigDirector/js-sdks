---
"@configdirector/nuxt-sdk": patch
---

In the browser, `useConfigDirectorStatus().readyStatus` now reads `"default"` after a context update through `useConfigDirectorContext().updateContext` that leaves the client not ready, such as one the server refused, and returns to `"ready"` when the client next becomes ready. It used to stay `"ready"`. After a context update the server refused, `useConfigDirectorContext().context` now goes back to the context the client holds, the one from before the update, so the refused context can be submitted again. It used to keep showing the refused context, and submitting it again did nothing. An accepted context update behaves as before.
