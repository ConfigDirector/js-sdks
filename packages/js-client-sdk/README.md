# ConfigDirector JavaScript Client SDK

[![npm][npm-badge]][npm]

JavaScript browser SDK for [ConfigDirector](https://www.configdirector.com), remote config and feature flags with typed values, JSON Schema validation, and safe renames of live flags. Start free, no card required.

## Install

```bash
npm install --save @configdirector/client-sdk
```

## Retrieve a value

```ts
import { createClient } from "@configdirector/client-sdk";

const client = createClient("YOUR-CLIENT-SDK-KEY");
await client.initialize();

const darkMode = client.getValue("dark-mode", false);
```

Full details are in the [official documentation](https://docs.configdirector.com/sdks/browser/javascript).

## Documentation

Refer to the [official documentation for the JavaScript SDK](https://docs.configdirector.com/sdks/browser/javascript).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/client-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/client-sdk
