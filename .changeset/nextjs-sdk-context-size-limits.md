---
"@configdirector/nextjs-sdk": minor
---

In the browser, a context over the context size limits is now ignored before it is sent: an `id` or a `name` longer than 256 characters, or `traits` over 64 KB once written as JSON (65,536 bytes in UTF-8). It is ignored as a context with an invalid kind is: the call completes and connects as if no context had been supplied, so flags evaluate for no context, `context` reads as none, and `contextUpdated` reports none. The SDK logs one error that names the limit, and ConfigDirector receives a count of these calls by limit, never the context's identifier, name or traits. ConfigDirector already ignores such a context when it arrives, so the values served do not change; the client now stops sending it. This applies to the client provider's `context` prop and to `useContext().updateContext`. The test client records such a call as an empty context in `contextUpdates`. On the server, the SDK still evaluates a context of any size, as before.
