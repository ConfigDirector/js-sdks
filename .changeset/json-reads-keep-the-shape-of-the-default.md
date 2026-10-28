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

A JSON config read with an object as its in-code default value now gives the config's value only when that value is a JSON object, and one read with an array as its in-code default value only when the value is a JSON array. Before, a JSON array reached a read with an object, and a JSON object a read with an array. Such a read now gives the in-code default value with the reason `type-mismatch`, or the error code `TYPE_MISMATCH` through the OpenFeature providers. It is reported to ConfigDirector, so the dashboard shows the Config type mismatch alert for the config, as it does for other mismatches.
