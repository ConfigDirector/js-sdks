---
"@configdirector/client-sdk": minor
"@configdirector/react-web-sdk": minor
"@configdirector/vue-sdk": minor
"@configdirector/react-native-sdk": minor
"@configdirector/nextjs-sdk": minor
"@configdirector/nuxt-sdk": minor
"@configdirector/openfeature-web-provider": minor
---

Client telemetry now starts with the client's first connection instead of when the client is constructed. In the browser the telemetry worker is created on the first successful `initialize`, and in React Native the flush timer starts then. A client that is only constructed and never initialized, such as the discarded instance React StrictMode creates, holds no worker or timer. Evaluations recorded before the first connection are kept, up to the telemetry queue limit, and reported once telemetry starts.
