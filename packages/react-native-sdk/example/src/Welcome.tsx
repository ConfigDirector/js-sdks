import { Text } from "react-native";
import { useConfigValue } from "@configdirector/react-native-sdk";

export default function Welcome() {
  const { value: exampleConfig, loading: exampleLoading } = useConfigValue(
    "example-hello-world",
    "DEFAULT",
  );

  const { value: featureFlag, loading: flagLoading } = useConfigValue(
    "example-feature-flag",
    false,
  );

  return (
    <>
      {exampleLoading ? (
        <Text>Loading string config...</Text>
      ) : (
        <Text>Result: {exampleConfig}</Text>
      )}

      {flagLoading ? (
        <Text>Loading feature flag...</Text>
      ) : (
        <Text>Flag is {featureFlag.toString()}</Text>
      )}
    </>
  );
}
