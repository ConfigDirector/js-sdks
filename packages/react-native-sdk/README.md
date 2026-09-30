# ConfigDirector React Native SDK

[![npm][npm-badge]][npm]

React Native SDK for [ConfigDirector](https://www.configdirector.com), remote config and feature flags with typed values, JSON Schema validation, and safe renames of live flags. Start free, no card required.

## Install

```bash
npm install --save @configdirector/react-native-sdk
```

## Retrieve a value

```tsx
import { Text } from "react-native";
import { ConfigDirectorProvider, useConfigValue } from "@configdirector/react-native-sdk";

export default function App() {
  return (
    <ConfigDirectorProvider sdkKey="YOUR-CLIENT-SDK-KEY" appName="MyApp" appVersion="1.0.0">
      <Home />
    </ConfigDirectorProvider>
  );
}

function Home() {
  const { value: darkMode } = useConfigValue("dark-mode", false);
  return <Text>dark-mode: {String(darkMode)}</Text>;
}
```

Full details are in the [official documentation](https://docs.configdirector.com/sdks/mobile/react-native).

## Test your code

`@configdirector/react-native-sdk/testing` creates a real client connected to an in-memory server that
your test controls. Render the production `ConfigDirectorProvider` with its `client` prop, or install
the test client for components that render their own provider, such as `App`.

```tsx
import { act, render } from "@testing-library/react-native";
import { ConfigDirectorProvider } from "@configdirector/react-native-sdk";
import { createTestClient, installTestClient } from "@configdirector/react-native-sdk/testing";

const testClient = createTestClient({ values: { "dark-mode": true } });

const view = render(
  <ConfigDirectorProvider client={testClient.client}>
    <Home />
  </ConfigDirectorProvider>,
);
await view.findByText("dark-mode: true");

act(() => testClient.setValue("dark-mode", false));
view.getByText("dark-mode: false");

const uninstall = installTestClient(testClient);
render(<App />);
uninstall();
```

The provider renders its children before initialization completes, so the first assertion uses
`findBy…`. Wrap `setValue`, `removeValue`, and `replaceValues` in `act()`. The test client also holds
or fails `initialize` and `updateContext`, and records every context in `contextUpdates`. A provider
never disposes a client it was given, removes its handlers and its `AppState` and NetInfo
subscriptions when it unmounts, and does not initialize a client that is ready or initializing.
Under the React Native Jest preset, `AppState.addEventListener` never calls its listener, so the
provider never pauses on its own; a test that calls the listener runs the production pause and
resume against the test client. The package and its dependency `@noble/hashes` are ESM, so a Jest
setup must transform both through `transformIgnorePatterns`.

## Documentation

Refer to the [official documentation for the React Native SDK](https://docs.configdirector.com/sdks/mobile/react-native).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/react-native-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/react-native-sdk
