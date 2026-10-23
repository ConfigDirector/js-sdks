---
"@configdirector/nextjs-sdk": minor
---

The client `ConfigDirectorProvider` opens its first browser connection after the effects of its first render, including its children's, have run. It connects with the latest context given by then: one given through `updateContext` from `useContext` during those effects, such as from a mount effect, otherwise the `context` prop. A mount-effect `updateContext` therefore opens one connection carrying that context instead of being dropped. `updateContext` keeps one identity across renders, so it is safe in an effect's dependency list. An `updateContext` call, or a `context` prop, equal to the context the provider already has opens no new connection.

The new `deferInitialization` prop, on the server and the client provider, holds the connection until a context is given. With it on, nothing connects and nothing is sent, `useConfigDirectorStatus` reports `loading`, and the hooks serve the server's initial configs or the in-code default values until the first context, from the prop or from `updateContext`, opens one connection carrying it; the values kept on the device for that context are served until live values arrive. A page that never gives a context never connects and stays `loading`. The prop defaults to `false` and has no effect in `offline` mode.
