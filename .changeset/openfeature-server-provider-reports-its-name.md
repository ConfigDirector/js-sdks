---
"@configdirector/openfeature-server-provider": patch
---

OpenFeature events, hooks and logs now show the provider's name, `ConfigDirectorProvider`, where they showed a minified name such as `e`: the `providerName` of provider events, `providerMetadata.name` in a hook's context, and OpenFeature's own log messages.
