# ConfigDirector Nuxt SDK

## Getting started

### 1. Install

Install from NPM:

```bash
npm install --save @configdirector/nuxt-sdk
```

### 2. Configure the Nuxt module

The Nuxt SDK requires the client SDK key for evaluation in the browser, and the server SDK key for server side rendering (SSR) and for server routes.

You can provide the keys in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  //...
  modules: ["@configdirector/nuxt-sdk"],
  runtimeConfig: {
    public: {
      configdirector: {
        clientSdkKey: "YOUR-CLIENT-SDK-KEY",
      },
    },
    configdirector: {
      serverSdkKey: "YOUR-SERVER-SDK-KEY", // This is a secret, do not commit to your source repository
    },
  },
});
```

Since the server SDK key is a secret value, the recommended approach is to provide it via an environment variable:

```bash
export NUXT_CONFIGDIRECTOR_SERVER_SDK_KEY=YOUR-SERVER-SDK-KEY
```

The client key can also be provided via an environment variable, which overrides the key provided in: `nuxt.config.ts`:

```bash
export NUXT_PUBLIC_CONFIGDIRECTOR_CLIENT_SDK_KEY=YOUR-CLIENT-SDK-KEY
```

### 3. Retrieve config values

Retrieve a config value with the `useConfigDirectorValue` composable:

```ts
<script setup lang="ts">
const { value } = useConfigDirectorValue<string>("my-config", "default value");
</script>

<template>
  <div>my-config is : {{ value }}</div>
</template>
```

The `value` returned is a ShallowRef that will update whenever the config value is updated in the ConfigDirector dashboard, or if it evaluates to a different value due to targeting rules (for example, if the user context is updated). Keep in mind that it is a ShallowRef when accessing it in scripts:

```ts
<script setup lang="ts">
const { value: myConfigValue } = useConfigDirectorValue<string>("my-config", "default value");

const someOtherDerivedValue = computed(() => `Hello ${myConfigValue.value}`);
</script>

<template>
  <div>my-config is : {{ someOtherDerivedValue }}</div>
</template>
```


You can also determine if the client is still initializing, so rather than transition from the default value to the evaluated value, you can show a loading state until the client is ready and config values are evaluated:

```ts
<script setup lang="ts">
const { value, loading } = useConfigDirectorValue<string>("my-config", "default value");
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else>my-config is : {{ value }}</div>
</template>
```

Additionally, you can also use the `useConfigDirectorStatus` composable to retrieve just the status:

```ts
<script setup lang="ts">
const { loading } = useConfigDirectorStatus();
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else><SomeComponentThatUsesConfigValues /></div>
</template>
```

### 4. Updating the user context

Update the user context with the `useConfigDirectorContext` composable:

```ts
<script setup lang="ts">
const { context, updateContext } = useConfigDirectorContext();
const { value } = useConfigDirectorValue<string>("my-config", "default value");

const onUpdate = () => {
  updateContext({
    id: "54321",
    name: "Another User",
  });
};
</script>

<template>
  <div>Current context: {{ context }}</div>
  <div>my-config is : {{ value }}</div>
  <button type="button" @click="onUpdate">Update Context</button>
</template>
```

### 5. Retrieving config values in a server handler

On the server side, there is a Nitro composable to retrieve the ConfigDirector client:

```ts
export default defineEventHandler(async (_event) => {
  const client = useConfigDirectorClient();
  return client.getValue("my-config", "default value");
});
```

`getValue` also accepts an optional user context:

```ts
export default defineEventHandler(async (_event) => {
  const client = useConfigDirectorClient();
  return client.getValue("my-config", "default value", { id: "some-user-id", name: "Example User" });
});
```

The server side evaluation is performed entirely by the SDK. Unlike the browser client which must retrieve new values when the user context is updated, the server evaluator can evaluate targeting rules locally (without additional network requests to ConfigDirector) for any user context.

## Getting Help

Reach out to us via https://www.configdirector.com/support
