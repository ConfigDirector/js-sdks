---
"@configdirector/react-native-sdk": minor
---

Whichever of `appName` and `appVersion` is left unset is now read from the platform when the app has `expo-application` or `react-native-device-info` installed, as the Swift and Flutter SDKs already do from their bundles. Setting a value still sends that value instead. When one cannot be read, the client says so at `info` when it is created, since React Native itself does not expose the app name or version.
