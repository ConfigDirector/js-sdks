---
"@configdirector/nextjs-sdk": patch
---

The client `ConfigDirectorProvider` now keeps its status and values updating for a client passed in the `client` prop, or an installed test client, after React StrictMode remounts it in development. Previously, in `next dev` and in tests rendered under `<StrictMode>`, `useConfigDirectorStatus` stayed `loading` and `useConfigValue` returned the in-code default value when the client was not ready yet, and config changes never re-rendered the components that read them when it was. The `hooks` passed to the provider also stopped firing, and a change to its `context` prop never reached the client. Production builds were not affected.
