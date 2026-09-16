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

## Documentation

Refer to the [official documentation for the React Native SDK](https://docs.configdirector.com/sdks/mobile/react-native).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/ConfigDirector/js-sdks/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/react-native-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/react-native-sdk
