# ConfigDirector OpenFeature Node.js Provider

[![npm][npm-badge]][npm]

[OpenFeature](https://openfeature.dev) Node.js provider SDK for [ConfigDirector](https://www.configdirector.com), remote config and feature flags with typed values, JSON Schema validation, and safe renames of live flags. Start free, no card required.

## Install

```bash
npm install --save @configdirector/openfeature-server-provider @openfeature/server-sdk
```

## Retrieve a value

```ts
import { OpenFeature } from "@openfeature/server-sdk";
import { ConfigDirectorProvider } from "@configdirector/openfeature-server-provider";

// The server SDK key is a secret. Do not commit it to your source code.
await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("YOUR-SERVER-SDK-KEY"));
const client = OpenFeature.getClient();

const newCheckout = await client.getBooleanValue("new-checkout", false);
```

Full details are in the [official documentation](https://docs.configdirector.com/sdks/server/openfeature-node).

## Test your code

Tests of code that reads flags through OpenFeature swap the provider for the in-memory one the OpenFeature Node.js SDK ships, `TypedInMemoryProvider` (`@openfeature/server-sdk` 1.21 and newer), so the test controls the values and nothing from ConfigDirector is involved:

```ts
import { OpenFeature, TypedInMemoryProvider } from "@openfeature/server-sdk";

const provider = new TypedInMemoryProvider({
  "new-checkout": { variants: { on: true, off: false }, defaultVariant: "on" },
});
await OpenFeature.setProviderAndWait(provider);
const client = OpenFeature.getClient();

expect(await client.getBooleanValue("new-checkout", false)).toBe(true);

provider.putConfiguration({
  "new-checkout": { variants: { on: true, off: false }, defaultVariant: "off" },
});
expect(await client.getBooleanValue("new-checkout", true)).toBe(false);
```

Full details are in the [testing section of the official documentation](https://docs.configdirector.com/sdks/openfeature/node-js#test-your-code).

## Documentation

Refer to the [official documentation for the OpenFeature Node.js provider](https://docs.configdirector.com/sdks/server/openfeature-node).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/openfeature-server-provider.svg
[npm]: https://www.npmjs.com/package/@configdirector/openfeature-server-provider
