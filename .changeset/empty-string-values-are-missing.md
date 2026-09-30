---
"@configdirector/client-sdk": minor
"@configdirector/server-sdk": minor
"@configdirector/openfeature-web-provider": minor
"@configdirector/openfeature-server-provider": minor
"@configdirector/react-web-sdk": minor
"@configdirector/vue-sdk": minor
"@configdirector/react-native-sdk": minor
"@configdirector/nextjs-sdk": minor
"@configdirector/nuxt-sdk": minor
---

A config whose served value is an empty string now evaluates to the default value with the `value-missing` reason, for every config type and every requested type, as the other ConfigDirector SDKs already do. Previously a string, JSON, or enum config holding an empty string was served as `""` when read as a string, and other reads reported `invalid-number`, `invalid-boolean`, or `invalid-json`. An application that relied on receiving `""` should read the config with `""` as its default value.
