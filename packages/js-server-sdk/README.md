# ConfigDirector Node.js SDK

[![npm][npm-badge]][npm]

Node.js server SDK for [ConfigDirector](https://www.configdirector.com), remote config and feature flags with typed values, JSON Schema validation, and safe renames of live flags. Start free, no card required.

## Install

```bash
npm install --save @configdirector/server-sdk
```

## Retrieve a value

```ts
import { createClient } from "@configdirector/server-sdk";

// The server SDK key is a secret. Do not commit it to your source code.
const client = createClient("YOUR-SERVER-SDK-KEY");
await client.initialize();

const newCheckout = client.getValue("new-checkout", false);
```

Full details are in the [official documentation](https://docs.configdirector.com/sdks/server/node-js).

## Documentation

Refer to the [official documentation for the Node.js SDK](https://docs.configdirector.com/sdks/server/node-js).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/server-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/server-sdk
