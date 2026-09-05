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

Fixed numeric config value parsing in `getValue` accepting malformed values: trailing garbage (`"42abc"` returned 42), surrounding whitespace, hexadecimal notation, and multi-dot strings (`"1.2.3"` returned 1.2) are now rejected and return the provided default with the evaluation reason `invalid-number`, matching the strict parsing already used by targeting-rule evaluation. Exponent notation on integer configs now parses to its full value (`"1e3"` is 1000, previously 1). Valid values, including fractional values on integer configs (still truncated), are unaffected.
