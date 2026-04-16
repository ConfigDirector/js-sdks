# ConfigDirector React Native SDK

## Getting started

### 1. Install

Install from NPM:

```bash
npm install --save @configdirector/react-native-sdk
```

### 2. Initialize the provider using your client SDK key

```tsx
import { View } from "react-native";
import AwesomeApp from "./AwesomeApp";
import { ConfigDirectorProvider } from "@configdirector/react-native-sdk";

export default function App() {
  return (
    <ConfigDirectorProvider
      sdkKey={"YOUR-CLIENT-SDK-KEY"}
      appName="MyAwesomeApp"
      appVersion="1.0.0">
      <View>
        <AwesomeApp />
      </View>
    </ConfigDirectorProvider>
  );
}
```

### 3. Retrieve config values

Retrieve a config value with the `useConfigValue` hook:

```tsx
import { useConfigValue } from "@configdirector/react-native-sdk";

function MyComponent() {
  const { value } = useConfigValue<string>("my-config", "default value");

  return <p>My config value: {value}</p>;
}

export default MyComponent;
```

You can also determine if the client is still initializing, so rather than transition from the default value to the evaluated value, you can show a loading state until the client is ready and config values are evaluated:

```tsx
import { useConfigValue } from "@configdirector/react-native-sdk";

function MyComponent() {
  const { value, loading } = useConfigValue<string>(
    "my-config",
    "default value",
  );

  if (loading) {
    return <p>Loading...</p>;
  } else {
    return <p>My config value: {value}</p>;
  }
}

export default MyComponent;
```

### 4. Updating the user context

Update the user context with the `useConfigDirectorContext` hook:

```tsx
import {
  useConfigValue,
  useConfigDirectorContext,
} from "@configdirector/react-native-sdk";

function MyComponent() {
  const { value: myConfigValue } = useConfigValue<string>(
    "my-config",
    "default value",
  );
  const { updateContext } = useConfigDirectorContext();

  useEffect(() => {
    updateContext({
      id: "54321",
      name: "Another User",
      traits: { customProperty: "customValue" },
    });
  }, []);

  return <p>My config value: {myConfigValue}</p>;
}

export default MyComponent;
```

## Requirements

- React Native **0.71 or later** (requires `ReadableStream` support)
- **Hermes** is strongly recommended. JavaScriptCore (JSC) is supported via a built-in UTF-8 fallback, but Hermes is the default engine in RN 0.70+ and provides better performance.

## Expo

This SDK is compatible with both **Expo managed workflow** and **bare workflow**.

- In the **managed workflow**, Hermes is the default engine — no additional setup needed.
- In the **bare workflow**, ensure Hermes is enabled in your `Podfile` (iOS) and `gradle.properties` (Android), which is the default in Expo SDK 47+.

Expo SDK 48 (RN 0.71) or later is required.

## License

MIT

## Getting Help

Reach out to us via https://www.configdirector.com/support
