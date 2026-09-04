---
"@configdirector/nuxt-sdk": patch
---

Fixed a server-side memory leak where every SSR render of a component using `useConfigDirectorValue` permanently registered a watch handler (capturing that request's user context) on the shared server SDK client. Watch registrations are now inert during SSR — the rendered HTML is a point-in-time snapshot and cannot receive updates — so the shared client's handler list stays bounded and no telemetry is emitted for long-gone requests when configs update.
