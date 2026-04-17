# ConfigDirector Vue SDK

## Getting started

### 1. Install

Install from NPM:

```bash
npm install --save @configdirector/vue-sdk
```

### 2. Configure the Vue plugin using your client SDK key

```ts
import { createApp } from "vue";
import App from "./App.vue";
import { ConfigDirectorPlugin } from "@configdirector/vue-sdk";

const app = createApp(App);

app.use(ConfigDirectorPlugin, { sdkKey: "YOUR_CLIENT_SDK_KEY" });

app.mount("#app");
```

### 3. Retrieve config values

Retrieve a config value with the `useConfigValue` composable:

```ts
<script setup lang="ts">
import { useConfigValue } from "@configdirector/vue-sdk";

const { value } = useConfigValue<string>("my-config", "default value");
</script>

<template>
  <div>my-config is : {{ value }}</div>
</template>
```

You can also determine if the client is still initializing, so rather than transition from the default value to the evaluated value, you can show a loading state until the client is ready and config values are evaluated:

```ts
<script setup lang="ts">
import { useConfigValue } from "@configdirector/vue-sdk";

const { value, loading } = useConfigValue<string>("my-config", "default value");
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else>my-config is : {{ value }}</div>
</template>
```

Alternatively, you can also use the `useClientStatus` composable to retrieve just the status:

```ts
<script setup lang="ts">
import { useClientStatus } from "@configdirector/vue-sdk";

const { loading } = useClientStatus();
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else><SomeComponentThatUsesConfigValues /></div>
</template>
```

### 4. Updating the user context

Update the user context with the `useContext` composable:

```ts
<script setup lang="ts">
import { useConfigValue, useContext } from "@configdirector/vue-sdk";

const { context, updateContext } = useContext();
const { value } = useConfigValue<string>("my-config", "default value");

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

## Getting Help

Reach out to us via https://www.configdirector.com/support
