---
"@configdirector/server-sdk": patch
"@configdirector/openfeature-server-provider": patch
"@configdirector/nextjs-sdk": patch
"@configdirector/nuxt-sdk": patch
---

A segment change now reaches watchers. When an update from the server carries a segment, the `watch` callbacks of every config whose targeting rules use that segment are called with the newly evaluated value, and the `configsUpdated` event lists those configs in `keys` beside the configs the update included. Previously, editing a segment or one of its environment overrides changed the values served without calling any watcher, and `configsUpdated` reported no keys. The OpenFeature provider lists the same configs in the `flagsChanged` list of `PROVIDER_CONFIGURATION_CHANGED`.
