---
"@configdirector/nuxt-sdk": minor
---

Breaking: the Nitro composable that returns the server SDK client is now `useConfigDirectorServerClient()`, and `useConfigDirectorClient()` is no longer auto-imported in server code. Server routes, middleware and plugins that called `useConfigDirectorClient()` must call `useConfigDirectorServerClient()` instead, which behaves the same. The old server name was shared with the app composable `useConfigDirectorClient()`, so `nuxt typecheck` (`vue-tsc -b`) checked server routes that called it against the app composable's type and failed with "Property 'getValue' does not exist on type '{ client: ConfigDirectorClient; }'", although the routes ran correctly. The app composable `useConfigDirectorClient()`, which returns `{ client }` in components, is unchanged.
