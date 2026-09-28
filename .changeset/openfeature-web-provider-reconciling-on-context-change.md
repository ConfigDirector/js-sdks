---
"@configdirector/openfeature-web-provider": patch
---

A context change no longer emits `PROVIDER_STALE`. The OpenFeature web SDK already puts the provider in the `RECONCILING` status and emits `PROVIDER_RECONCILING` while the provider's context change handler runs, as the OpenFeature specification expects, so handlers for `PROVIDER_STALE` are no longer called on `setContext`.
