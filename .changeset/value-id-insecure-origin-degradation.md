---
"@configdirector/client-sdk": patch
"@configdirector/nextjs-sdk": patch
"@configdirector/nuxt-sdk": patch
"@configdirector/openfeature-web-provider": patch
"@configdirector/react-web-sdk": patch
"@configdirector/vue-sdk": patch
---

Fixed telemetry breaking on insecure origins (plain HTTP), where the browser does not expose `crypto.subtle`. Value-id generation now degrades gracefully by omitting the value id instead of failing, so telemetry events for JSON and long config values are still reported on non-HTTPS deployments such as intranet or local test environments.
