# ConfigDirector React SDK

[![npm][npm-badge]][npm]

React SDK for [ConfigDirector](https://www.configdirector.com), remote config and feature flags with typed values, JSON Schema validation, and safe renames of live flags. Start free, no card required.

## Install

```bash
npm install --save @configdirector/react-web-sdk
```

## Retrieve a value

```tsx
import { createRoot } from "react-dom/client";
import { ConfigDirectorProvider, useConfigValue } from "@configdirector/react-web-sdk";

createRoot(document.getElementById("root")!).render(
  <ConfigDirectorProvider sdkKey="YOUR-CLIENT-SDK-KEY">
    <App />
  </ConfigDirectorProvider>,
);

function App() {
  const { value: darkMode } = useConfigValue("dark-mode", false);
  return <p>dark-mode: {String(darkMode)}</p>;
}
```

Full details are in the [official documentation](https://docs.configdirector.com/sdks/browser/react).

## Test your code

`@configdirector/react-web-sdk/testing` creates a real client connected to an in-memory server that
your test controls. Render the production `ConfigDirectorProvider` with its `client` prop, or install
the test client for components that render their own provider.

```tsx
import { act, render, screen } from "@testing-library/react";
import { ConfigDirectorProvider } from "@configdirector/react-web-sdk";
import { createTestClient, installTestClient } from "@configdirector/react-web-sdk/testing";

const testClient = createTestClient({ values: { "dark-mode": true } });

render(
  <ConfigDirectorProvider client={testClient.client}>
    <App />
  </ConfigDirectorProvider>,
);
expect(await screen.findByText("dark-mode: true")).toBeInTheDocument();

act(() => testClient.setValue("dark-mode", false));
expect(screen.getByText("dark-mode: false")).toBeInTheDocument();

const uninstall = installTestClient(testClient);
render(<AppWithItsOwnProvider />);
uninstall();
```

The provider renders its children before initialization completes, so the first assertion uses
`findBy…`. Wrap `setValue`, `removeValue`, and `replaceValues` in `act()`. The test client also holds
or fails `initialize` and `updateContext`, and records every context in `contextUpdates`. A provider
never disposes a client it was given, removes its handlers when it unmounts, and does not initialize
a client that is ready or initializing.

## Documentation

Refer to the [official documentation for the React SDK](https://docs.configdirector.com/sdks/browser/react).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/react-web-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/react-web-sdk
