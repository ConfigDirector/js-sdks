---
"@configdirector/react-native-sdk": minor
---

The SDK now keeps its client session across app starts. When `@react-native-async-storage/async-storage` is installed, the instance ID is stored in AsyncStorage and reused for six hours from when it was generated, so an app reopened within that window continues the same client session instead of starting a new one. The package declares `@react-native-async-storage/async-storage` as an optional peer dependency. Without it, every app start begins a new client session as before, the SDK logs a warning when the client is created, and the instance ID is reported to ConfigDirector as ephemeral. `createClient` and `ConfigDirectorProvider` are unchanged.
