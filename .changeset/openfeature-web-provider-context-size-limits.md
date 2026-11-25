---
"@configdirector/openfeature-web-provider": minor
---

An evaluation context over the context size limits is now ignored before it is sent: an `id` or a `name` longer than 256 characters, or `traits` over 64 KB once written as JSON (65,536 bytes in UTF-8). Initialization and context changes still succeed, flags resolve to the values for no context, and the SDK logs an error that names the limit. ConfigDirector receives a count of these context changes by limit, never the context's identifier, name or traits. ConfigDirector already ignores such a context when it arrives, so the values served do not change; the provider now stops sending it.
