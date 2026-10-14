---
"@configdirector/nextjs-sdk": minor
---

In the browser, the client `ConfigDirectorProvider` evaluates targeting rules on the context's `kind`. A context with an invalid kind never makes the client throw: `initialize` and `updateContext` log an error, stop using the previous context, and connect as if no context had been supplied, so flags evaluate for no context, `context` reads as none, and `contextUpdated` reports none. ConfigDirector receives a count of these calls with a sample of each invalid kind, never the context's identifier, name or traits. This applies to the provider's `context` prop and to `useContext().updateContext`. The test client records such a call as an empty context in `contextUpdates`.
