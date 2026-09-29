---
"@configdirector/client-sdk": minor
"@configdirector/server-sdk": minor
"@configdirector/openfeature-web-provider": minor
"@configdirector/openfeature-server-provider": minor
"@configdirector/react-web-sdk": minor
"@configdirector/vue-sdk": minor
"@configdirector/react-native-sdk": minor
"@configdirector/nextjs-sdk": minor
"@configdirector/nuxt-sdk": minor
---

The client now reports configs that a full update from the server no longer includes. The `configsUpdated` event has a new `removedKeys` property listing them, and `keys` still lists only the configs the update included. The `watch` callbacks of a removed config are called with their default value. Previously a removed config silently stopped being served, and its watchers kept acting on the last value they were sent. The OpenFeature providers include removed keys in the `flagsChanged` list of `PROVIDER_CONFIGURATION_CHANGED`.
