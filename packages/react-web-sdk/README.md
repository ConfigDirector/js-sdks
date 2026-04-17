# ConfigDirector React SDK

## Getting started

### 1. Install

Install from NPM:

```bash
npm install --save @configdirector/react-web-sdk
```

### 2. Initialize the provider using your client SDK key

```tsx
import { createRoot } from "react-dom/client"
import App from "./App"
import { ConfigDirectorProvider } from "@configdirector/react-web-sdk";

createRoot(document.getElementById("root")!).render(
  <ConfigDirectorProvider
    sdkKey="YOUR-CLIENT-SDK-KEY"
    context={{ id: "12345", name: "Example User" }}>
    <App />
  </ConfigDirectorProvider>
);
```

Alternatively, you can initialize it with the HOC asynchronously and wait for initialization
before starting your application. This can prevent the config values to flicker from the default
value to the evaluated value during initialization.

```tsx
import { createRoot } from "react-dom/client"
import App from "./App"
import { withProvider } from "@configdirector/react-web-sdk";

(async () => {
  const ConfigDirectorProvider = await withProvider({
    sdkKey: "YOUR-CLIENT-SDK-KEY",
    context: { id: "12345", name: "Example User" },
  });

  createRoot(document.getElementById('root')!).render(
    <ConfigDirectorProvider>
      <App />
    </ConfigDirectorProvider>
  );
})();
```

### 3. Retrieve config values

Retrieve a config value with the `useConfigValue` hook:

```tsx
import { useConfigValue } from "@configdirector/react-web-sdk";

function MyComponent() {
  const { value } = useConfigValue<string>("my-config", "default value");

  return (<p>My config value: {value}</p>);
}

export default MyComponent;
```

You can also determine if the client is still initializing, so rather than transition from the default value to the evaluated value, you can show a loading state until the client is ready and config values are evaluated:

```tsx
import { useConfigValue } from "@configdirector/react-web-sdk";

function MyComponent() {
  const { value, loading } = useConfigValue<string>("my-config", "default value");

    if (loading) {
        return (<p>Loading...</p>);
    } else {
        return (<p>My config value: {value}</p>);
    }
}

export default MyComponent;
```

### 4. Updating the user context

Update the user context with the `useContext` hook:

```tsx
import { useConfigValue, useContext } from "@configdirector/react-web-sdk";

function MyComponent() {
  const { value: myConfigValue } = useConfigValue<string>("my-config", "default value");
  const { updateContext } = useContext();

  useEffect(() => {
    updateContext({ id: "54321", name: "Another User" });
  }, []);

  return (<p>My config value: {myConfigValue}</p>);
}

export default MyComponent;
```

## Getting Help

Reach out to us via https://www.configdirector.com/support
