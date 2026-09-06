---
"@configdirector/nuxt-sdk": minor
---

Fixed requests arriving before the server SDK client received its initial config payload (for example right after the Nuxt server starts) rendering with default values. Such requests are now held until the payload arrives, for up to the client's initialization timeout, after which they proceed with defaults as before. The server client's connection options are now configurable under `runtimeConfig.configdirector.connection` (`mode`, `pollingInterval`, `timeout`), including through the matching `NUXT_CONFIGDIRECTOR_CONNECTION_*` environment variables, and the Nitro app exposes the client's initialization promise as `configDirectorInitialization` for code running outside the request lifecycle.
