# ConfigDirector JavaScript Server SDK

## Getting started

### 1. Install

Install from NPM:

```bash
npm install --save @configdirector/server-sdk
```

### 2. Create and initialize a client using your server SDK key

```ts
import { createClient } from "@configdirector/server-sdk";

const client = createClient("YOUR-SERVER-SDK-KEY");
await client.initialize();
```

### 3. Retrieve config values

Retrieve a config value synchronously via `getValue`. The first argument is the config key, and the second the default value to be returned if the config state is not available. The third (optional) argument is the user context for targeting rules evaluation.

If `getValue` is called before initialization is complete, the default value will be returned.

```ts
client.getValue("my-string-config-key", "Default");

client.getValue("my-boolean-config-key", false, { id: "user-id", name: "Example User" });

client.getValue<MyEnum>("my-enum-config-key", MyEnum.SomeDefaultValue);
```

You can also subscribe to config value updates:

```ts
const unwatchMyKey = client.watch("my-string-config-key", "Default", (newValue) => {
  console.log("Value updated:", newValue);
}, { id: "user-id" } /* Optional user context */);

unwatchMyKey(); // Call the unwatch function returned to remove the observer

client.unwatch("my-string-config-key"); // Removes all observers for that key
```

## Getting Help

Reach out to us via https://www.configdirector.com/support
