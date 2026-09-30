---
"@configdirector/react-web-sdk": patch
"@configdirector/react-native-sdk": patch
---

`ConfigDirectorProvider` builds a new client when React mounts it again after it disposed its own, which React StrictMode does in development. Previously the remounted provider initialized the disposed client again, which reconnected but had lost its telemetry and the `hooks` given to the provider.
