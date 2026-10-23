---
"@configdirector/client-sdk": minor
"@configdirector/nextjs-sdk": minor
"@configdirector/nuxt-sdk": minor
"@configdirector/openfeature-web-provider": minor
"@configdirector/react-web-sdk": minor
"@configdirector/vue-sdk": minor
---

The instance ID the SDK stores in the browser's `localStorage` now lasts until the site's data is cleared, instead of being replaced six hours after it was created, so an anonymous visitor counts as one monthly active user a month. An instance ID stored by an earlier version of the SDK is kept.
