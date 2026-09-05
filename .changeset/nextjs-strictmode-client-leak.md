---
"@configdirector/nextjs-sdk": patch
---

Fixed the client `ConfigDirectorProvider` leaking a live browser client (streaming connection and telemetry worker) under React StrictMode in development: the simulated remount unmounted the provider before the client reference reached component state, so the first client was never disposed. The provider now tracks its client on the instance, disposes it reliably on unmount, and no longer updates state from an initialization that finished after unmount.
