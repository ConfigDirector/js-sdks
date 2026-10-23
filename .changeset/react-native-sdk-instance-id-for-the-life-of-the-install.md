---
"@configdirector/react-native-sdk": minor
---

The instance ID the SDK stores in AsyncStorage now lasts for the life of the install, instead of being replaced six hours after it was created, so a person using the app without a context `id` counts as one monthly active user a month. An instance ID stored by an earlier version of the SDK is kept. Without `@react-native-async-storage/async-storage`, every app start still gets a new instance ID, and the warning the SDK logs now says that every app start looks like a new install and that a context without an `id` gets a new identifier each time.
