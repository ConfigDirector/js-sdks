---
"@configdirector/react-web-sdk": patch
---

Fixed the provider returned by `withProvider` registering new `configsUpdated`/`clientReady` listeners on the client on every render without ever removing them, causing unbounded listener growth and redundant re-renders. Listeners are now registered once on mount and removed on unmount, and a client that is already ready when the provider mounts is reflected in the ready status immediately.
