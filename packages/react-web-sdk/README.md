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

## Documentation

Refer to the [official documentation for the React SDK](https://docs.configdirector.com/sdks/browser/react).

There is also [a quickstart guide for ConfigDirector and any of our SDKs](https://docs.configdirector.com/getting-started/quickstart).

## Getting Help

- [Ask a question in Discussions](https://github.com/orgs/ConfigDirector/discussions)
- [Contact support](https://www.configdirector.com/support)

[//]: # "links"
[npm-badge]: https://img.shields.io/npm/v/@configdirector/react-web-sdk.svg
[npm]: https://www.npmjs.com/package/@configdirector/react-web-sdk
