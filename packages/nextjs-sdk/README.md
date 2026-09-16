# ConfigDirector Next.js SDK

[![npm][npm-badge]][npm]

Next.js SDK for [ConfigDirector](https://www.configdirector.com), remote config and feature flags with typed values, JSON Schema validation, and safe renames of live flags. Start free, no card required.

## Install

```bash
npm install --save @configdirector/nextjs-sdk
```

## Retrieve a value

```ts
// instrumentation.ts
export async function register() {
  const { register } = await import("@configdirector/nextjs-sdk/server");
  await register({ serverSdkKey: process.env["CONFIGDIRECTOR_SERVER_SDK_KEY"] });
}
```

```tsx
// Any client component, inside the ConfigDirectorProvider from the root layout
"use client";
import { useConfigValue } from "@configdirector/nextjs-sdk/client";

const { value: darkMode } = useConfigValue("dark-mode", false);
```

Full details are in the [official documentation](https://docs.configdirector.com/sdks/meta/nextjs).

## Documentation

Refer to the [official documentation for the Next.js SDK](https://docs.configdirector.com/sdks/meta/nextjs).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/ConfigDirector/js-sdks/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/nextjs-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/nextjs-sdk
