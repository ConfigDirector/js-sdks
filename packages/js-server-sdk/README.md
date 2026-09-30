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

## Test your code

`@configdirector/server-sdk/testing` creates a real client connected to an in-memory server that your
test controls, so the code under test runs against the production client without opening a network
connection or sending telemetry.

```ts
import { createTestClient } from "@configdirector/server-sdk/testing";

const testClient = createTestClient({ values: { "new-checkout": true } });
await testClient.client.initialize();

const service = new CheckoutService(testClient.client);

testClient.setValue("new-checkout", false);
testClient.removeValue("new-checkout");
```

The test client also holds or fails `initialize` (`holdInitialization`, `completeInitialization`,
`failInitialization`) so startup and error handling can be tested. Values keep their type: a
boolean, an integral number (`integer`), any other number (`float`), a string, or a plain object or
array (`json`), and every context receives the same value. Reads behave exactly as they do against
ConfigDirector. Under the test client, the first update is delivered inside `initialize`, so
watchers run before `initialize` resolves and `configsUpdated` fires before `clientReady`; a held
`initialize` that times out or is interrupted by `dispose` leaves the client not ready until the
next `initialize`; and an exception thrown by a watcher during a delivery is logged, as the
production transports do. Close the client with `dispose`, which ends a held `initialize`;
`closeConnection` does not.

## Documentation

Refer to the [official documentation for the Node.js SDK](https://docs.configdirector.com/sdks/server/node-js).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/server-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/server-sdk
