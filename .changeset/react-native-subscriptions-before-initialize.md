---
"@configdirector/react-native-sdk": patch
---

`ConfigDirectorProvider` now subscribes to `AppState` and NetInfo before it awaits `initialize`, so a provider that unmounts before initialization finishes removes both subscriptions. Previously the subscriptions were added after `initialize` resolved, and an early unmount (for example under React StrictMode) left them registered for good.
