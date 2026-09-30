# ConfigDirector Vue SDK

[![npm][npm-badge]][npm]

Vue SDK for [ConfigDirector](https://www.configdirector.com), remote config and feature flags with typed values, JSON Schema validation, and safe renames of live flags. Start free, no card required.

## Install

```bash
npm install --save @configdirector/vue-sdk
```

## Retrieve a value

```ts
// main.ts
import { ConfigDirectorPlugin } from "@configdirector/vue-sdk";

app.use(ConfigDirectorPlugin, { sdkKey: "YOUR-CLIENT-SDK-KEY" });
```

```vue
<script setup lang="ts">
import { useConfigValue } from "@configdirector/vue-sdk";

const { value: darkMode } = useConfigValue("dark-mode", false);
</script>
```

Full details are in the [official documentation](https://docs.configdirector.com/sdks/browser/vue).

## Test your code

`@configdirector/vue-sdk/testing` creates a real client connected to an in-memory server that your
test controls. Install the production plugin with the test client's client, as you would with a
pre-initialized client.

```ts
import { nextTick } from "vue";
import { render, screen } from "@testing-library/vue";
import { ConfigDirectorPlugin } from "@configdirector/vue-sdk";
import { createTestClient } from "@configdirector/vue-sdk/testing";

const testClient = createTestClient({ values: { "dark-mode": true } });

render(App, { global: { plugins: [[ConfigDirectorPlugin, testClient.client]] } });
await screen.findByText("dark-mode: true");

testClient.setValue("dark-mode", false);
await nextTick();
screen.getByText("dark-mode: false");
```

The plugin initializes a client that is neither ready nor initializing, so the first assertion uses
`findBy…`; a client initialized before `app.use` is ready on the first render. Await `nextTick()`
after `setValue`, `removeValue`, and `replaceValues`. The test client also holds or fails
`initialize` and `updateContext`, and records every context in `contextUpdates`.

## Documentation

Refer to the [official documentation for the Vue SDK](https://docs.configdirector.com/sdks/browser/vue).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/vue-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/vue-sdk
