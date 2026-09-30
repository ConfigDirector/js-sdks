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

## Test your code

`@configdirector/client-sdk/testing` creates a real client connected to an in-memory server that your
test controls, so the code under test runs against the production client without opening a network
connection or sending telemetry.

```ts
import { createTestClient } from "@configdirector/client-sdk/testing";

const testClient = createTestClient({ values: { "new-checkout": true } });
await testClient.client.initialize();

renderCheckout(testClient.client);

testClient.setValue("new-checkout", false);
testClient.removeValue("new-checkout");
```

The test client also holds or fails `initialize` and `updateContext` (`holdInitialization`,
`completeInitialization`, `failInitialization`, and their `ContextUpdate` counterparts) so loading
and error states can be tested, and records every context in `contextUpdates`. Values keep their
type: a boolean, an integral number (`integer`), any other number (`float`), a string, or a plain
object or array (`json`), and reads behave exactly as they do against ConfigDirector. Under the test
client, `initialize` emits `contextUpdated`, then `configsUpdated`, then `clientReady`; a held
attempt that times out or is interrupted by `pauseNetwork`, `dispose`, or a new attempt leaves the
client not ready until the next attempt; and an exception thrown by a watcher during a delivery is
logged, as the production transports do.

## Documentation

Refer to the [official documentation for the JavaScript SDK](https://docs.configdirector.com/sdks/browser/javascript).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/client-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/client-sdk
