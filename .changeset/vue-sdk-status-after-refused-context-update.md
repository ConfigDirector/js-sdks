---
"@configdirector/vue-sdk": patch
---

`useClientStatus().readyStatus` now reads `"default"` after a context update through `useContext().updateContext` that leaves the client not ready, such as one the server refused, and returns to `"ready"` when the client next becomes ready. It used to stay `"ready"`. An accepted context update behaves as before.
