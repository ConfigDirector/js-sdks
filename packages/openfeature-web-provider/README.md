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

## Documentation

Refer to the [official documentation for the OpenFeature web provider](https://docs.configdirector.com/sdks/browser/openfeature-web).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/ConfigDirector/js-sdks/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/openfeature-web-provider.svg
[npm]: https://www.npmjs.com/package/@configdirector/openfeature-web-provider
