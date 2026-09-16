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

## Documentation

Refer to the [official documentation for the Nuxt SDK](https://docs.configdirector.com/sdks/meta/nuxt).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/ConfigDirector/js-sdks/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/nuxt-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/nuxt-sdk
