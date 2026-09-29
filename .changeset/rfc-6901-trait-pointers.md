---
"@configdirector/config-evaluator-internal": patch
"@configdirector/server-sdk": patch
"@configdirector/openfeature-server-provider": patch
"@configdirector/nextjs-sdk": patch
"@configdirector/nuxt-sdk": patch
---

Trait pointers in targeting rules now follow RFC 6901 exactly. A pointer that does not start with `/` no longer resolves by dropping its first character, and a pointer with an escape other than `~0` or `~1` no longer resolves to a member named with the literal text; both now resolve to a missing trait. The SDKs no longer depend on `@jsonjoy.com/json-pointer`, whose packages require `tslib` without declaring it as a dependency, so the SDKs failed to load with `Cannot find module 'tslib'` in Yarn projects that did not otherwise install it.
