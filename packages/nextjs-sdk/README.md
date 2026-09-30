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

## Test your code

The `/client/testing` and `/server/testing` entry points create real clients connected to an in-memory
server that your test controls, so components and server code run against the production SDK without
opening a network connection or sending telemetry.

```tsx
// Client Components: render the production provider with its client prop, or install the test client
import { act, render, screen } from "@testing-library/react";
import { ConfigDirectorProvider } from "@configdirector/nextjs-sdk/client";
import { createTestClient, installTestClient } from "@configdirector/nextjs-sdk/client/testing";

const testClient = createTestClient({ values: { "dark-mode": true } });
render(
  <ConfigDirectorProvider client={testClient.client}>
    <Page />
  </ConfigDirectorProvider>,
);
act(() => testClient.setValue("dark-mode", false));

const uninstall = installTestClient(testClient);
render(<AppWithItsOwnProvider />);
uninstall();
```

```ts
// Server code: install a server test client where register() would have put the singleton
import { createTestClient, installServerTestClient } from "@configdirector/nextjs-sdk/server/testing";
import { getConfigClient } from "@configdirector/nextjs-sdk/server";

const serverTestClient = createTestClient({ values: { "dark-mode": true } });
const uninstall = installServerTestClient(serverTestClient);
await serverTestClient.client.initialize();
getConfigClient().getValue("dark-mode", false, { id: "user-1" }); // true
uninstall();
```

A provider given a client reports it on the first render, never disposes it, removes its handlers when
it unmounts, and does not initialize a client that is ready or initializing. `installServerTestClient`
does not initialize the client; the test calls `initialize`, as `register()` would.

## Documentation

Refer to the [official documentation for the Next.js SDK](https://docs.configdirector.com/sdks/meta/nextjs).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/nextjs-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/nextjs-sdk
