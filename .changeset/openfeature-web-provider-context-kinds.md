---
"@configdirector/openfeature-web-provider": minor
---

The provider reads a top-level `kind` field from the evaluation context, beside `targetingKey`, as the ConfigDirector context kind, for example `{ targetingKey: "42", kind: "device" }`; leaving it out means `user`. A `kind` inside `traits` stays an ordinary trait. A kind must have 1 to 64 characters, using only lowercase letters, digits, `-` and `_`. With any other kind, including one that is not a string, the whole context is ignored: initialization and context changes still succeed, flags resolve to the values for no context, and the SDK logs an error.
