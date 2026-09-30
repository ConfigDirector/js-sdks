# ConfigDirector OpenFeature Web Provider

[![npm][npm-badge]][npm]

[OpenFeature](https://openfeature.dev) web provider SDK for [ConfigDirector](https://www.configdirector.com), remote config and feature flags with typed values, JSON Schema validation, and safe renames of live flags. Start free, no card required.

## Install

```bash
npm install --save @configdirector/openfeature-web-provider @openfeature/web-sdk
```

## Retrieve a value

```ts
import { OpenFeature } from "@openfeature/web-sdk";
import { ConfigDirectorProvider } from "@configdirector/openfeature-web-provider";

await OpenFeature.setProviderAndWait(new ConfigDirectorProvider("YOUR-CLIENT-SDK-KEY"));
const client = OpenFeature.getClient();

const darkMode = client.getBooleanValue("dark-mode", false);
```

Full details are in the [official documentation](https://docs.configdirector.com/sdks/browser/openfeature-web).

## Test your code

Tests of code that reads flags through OpenFeature swap the provider for the in-memory one the OpenFeature Web SDK ships, `TypedInMemoryProvider` (`@openfeature/web-sdk` 1.8 and newer), so the test controls the values and nothing from ConfigDirector is involved:

```ts
import { OpenFeature, TypedInMemoryProvider } from "@openfeature/web-sdk";

const provider = new TypedInMemoryProvider({
  "new-checkout": { variants: { on: true, off: false }, defaultVariant: "on" },
});
await OpenFeature.setProviderAndWait(provider);
const client = OpenFeature.getClient();

expect(client.getBooleanValue("new-checkout", false)).toBe(true);

await provider.putConfiguration({
  "new-checkout": { variants: { on: true, off: false }, defaultVariant: "off" },
});
expect(client.getBooleanValue("new-checkout", true)).toBe(false);
```

Full details are in the [testing section of the official documentation](https://docs.configdirector.com/sdks/openfeature/web#test-your-code).

## Documentation

Refer to the [official documentation for the OpenFeature web provider](https://docs.configdirector.com/sdks/browser/openfeature-web).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/openfeature-web-provider.svg
[npm]: https://www.npmjs.com/package/@configdirector/openfeature-web-provider
