---
"@configdirector/openfeature-server-provider": minor
---

The provider runs in `offline` mode through the client options it already takes: `connection: { mode: "offline", file }` or `connection: { mode: "offline", values }` serves those values to every evaluation without connecting to ConfigDirector or sending anything. An offline provider needs no server SDK key, so `new ConfigDirectorProvider({ connection: { mode: "offline", values } })` takes the options alone. Registering an offline provider whose values cannot be loaded fails with a `ConfigDirectorInitializationError`, which the package exports along with the `OfflineValues`, `OfflineValue` and `OfflineClientOptions` types.
