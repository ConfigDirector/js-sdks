---
"@configdirector/react-native-sdk": patch
---

The values kept on the device, in AsyncStorage or in a `CachingProvider` of your own, no longer include the client SDK key, only its SHA-256 digest. Values kept by an earlier version are removed on the first app start after the upgrade, so that start serves the in-code default values until live values arrive.
