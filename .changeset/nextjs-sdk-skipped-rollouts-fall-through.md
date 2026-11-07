---
"@configdirector/nextjs-sdk": patch
---

On the server, a context without an `id` that skips a percentage rollout is now served by the targeting rules after it, as it is after a conditional rule it does not match. Since 1.14.0 the skipped rollout ended the evaluation and the default targeting rule value was served, even when a later rule matched the context. The server SDK client, `generateSsrConfigSet` and the server `ConfigDirectorProvider` serve the later rule's value; the reason `rollout-skipped-no-identifier` stays for a context served the default targeting rule value after a skipped rollout.
