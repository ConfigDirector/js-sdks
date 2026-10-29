---
"@configdirector/nuxt-sdk": patch
---

The server now sends the `appName` and `appVersion` set in `runtimeConfig.public.configdirector`, as the browser does. Before, a targeting rule on the app name or app version never matched during SSR, in server routes or in the server composables, even with both set. The server's connection now also reports the app name and version, so the ConfigDirector live feed shows the server under your app's name instead of `nuxt-sdk`.
