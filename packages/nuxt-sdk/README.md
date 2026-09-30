# ConfigDirector Nuxt SDK

[![npm][npm-badge]][npm]

Nuxt SDK for [ConfigDirector](https://www.configdirector.com), remote config and feature flags with typed values, JSON Schema validation, and safe renames of live flags. Start free, no card required.

## Install

```bash
npm install --save @configdirector/nuxt-sdk
```

## Retrieve a value

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@configdirector/nuxt-sdk"],
  runtimeConfig: {
    public: { configdirector: { clientSdkKey: "YOUR-CLIENT-SDK-KEY" } },
    configdirector: { serverSdkKey: "YOUR-SERVER-SDK-KEY" },
  },
});
```

```vue
<script setup lang="ts">
const { value: darkMode } = useConfigDirectorValue("dark-mode", false);
</script>
```

Full details are in the [official documentation](https://docs.configdirector.com/sdks/meta/nuxt).

## Test your code

`@configdirector/nuxt-sdk/testing` creates a real client connected to an in-memory server that your
test controls. Install it before the Nuxt app is created, at the top level of a test file or a
vitest setup file, and the ConfigDirector plugin provides it to the app instead of building a
client. Tests run in the `nuxt` environment of `@nuxt/test-utils` 4 (which needs vitest 4).

```ts
import { nextTick } from "vue";
import { mountSuspended } from "@nuxt/test-utils/runtime";
import { createTestClient, installTestClient } from "@configdirector/nuxt-sdk/testing";
import Checkout from "~/components/Checkout.vue";

const testClient = createTestClient({ values: { "dark-mode": true } });
installTestClient(testClient);

test("renders the dark mode", async () => {
  const component = await mountSuspended(Checkout);
  expect(component.text()).toContain("dark-mode: true");

  testClient.setValue("dark-mode", false);
  await nextTick();
  expect(component.text()).toContain("dark-mode: false");
});
```

`@nuxt/test-utils` 4 creates the app once per test file, inside a `beforeAll` hook, so install at
module level rather than in a hook, and reset the values between tests with `replaceValues`.
`@nuxt/test-utils` 3 creates the app before the test file loads, so the plugin cannot see a test
client installed there; upgrade to use the testing entry. While
installed, the plugin needs no `clientSdkKey`. Await `nextTick()` after `setValue`, `removeValue`,
and `replaceValues`. The test client also holds or fails `initialize` and `updateContext`, and
records every context in `contextUpdates`.

## Documentation

Refer to the [official documentation for the Nuxt SDK](https://docs.configdirector.com/sdks/meta/nuxt).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/nuxt-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/nuxt-sdk
