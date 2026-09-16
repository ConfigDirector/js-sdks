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

## Documentation

Refer to the [official documentation for the OpenFeature Node.js provider](https://docs.configdirector.com/sdks/server/openfeature-node).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/ConfigDirector/js-sdks/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/openfeature-server-provider.svg
[npm]: https://www.npmjs.com/package/@configdirector/openfeature-server-provider
