---
"@configdirector/client-sdk": patch
"@configdirector/server-sdk": patch
"@configdirector/nextjs-sdk": patch
"@configdirector/nuxt-sdk": patch
"@configdirector/openfeature-server-provider": patch
"@configdirector/openfeature-web-provider": patch
"@configdirector/react-native-sdk": patch
"@configdirector/react-web-sdk": patch
"@configdirector/vue-sdk": patch
---

Fixed `getValue` returning a raw string of the wrong runtime type when the requested type and the config's declared type are incompatible (for example a boolean default against an integer config, or an object default against a string config). Such mismatches now return the provided default value with the evaluation reason `type-mismatch`. A JSON config whose parsed value does not match the requested type (including a literal `null` requested as an object) also returns the default with `type-mismatch` instead of the wrong-typed value. Enum configs requested as a boolean now parse `"true"`/`"false"` values instead of returning the raw string. String defaults continue to accept any config type as-is, and enum values that cast to a consumer-defined string or numeric enum continue to be returned unchanged.
