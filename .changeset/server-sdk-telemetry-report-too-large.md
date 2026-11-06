---
"@configdirector/server-sdk": patch
---

The SDK now keeps reporting telemetry after ConfigDirector refuses a report as too large. That report is discarded with a warning and the next one is still sent. Before, the refusal stopped telemetry until the process restarted.
