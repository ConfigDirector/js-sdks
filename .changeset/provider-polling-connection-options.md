---
"@configdirector/react-web-sdk": minor
"@configdirector/vue-sdk": minor
"@configdirector/react-native-sdk": minor
"@configdirector/nextjs-sdk": minor
"@configdirector/nuxt-sdk": minor
---

The connection `mode` (`streaming` or `polling`) and `pollingInterval` (in seconds) options of the underlying client SDK can now be set from the framework wrappers. The React, Vue, React Native and Next.js client providers accept them as `mode` and `pollingInterval` next to `url` and `timeout`. The Nuxt module reads them for the browser client from `runtimeConfig.public.configdirector.connection` (`mode`, `pollingInterval` and `timeout`), which can also be set through the `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_MODE`, `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_POLLING_INTERVAL` and `NUXT_PUBLIC_CONFIGDIRECTOR_CONNECTION_TIMEOUT` environment variables, mirroring the existing server-side `runtimeConfig.configdirector.connection` keys.
