import { View, StyleSheet } from "react-native";
import {
  createConsoleLogger,
  ConfigDirectorProvider,
  type ConfigDirectorContext,
} from "@configdirector/react-native-sdk";
import Welcome from "./Welcome";

const sdkKey =
  "ck_test_bfc68b368872049d8f5a7f16e49621b6738f3dd4ad137f51fc4272978683cf1cdf01fca34175";
const logger = createConsoleLogger("debug");
const context: ConfigDirectorContext = {
  id: "user-123",
  traits: {
    role: "admin"
  }
};

export default function App() {
  return (
    <ConfigDirectorProvider sdkKey={sdkKey} logger={logger} context={context}>
      <View style={styles.container}>
        <Welcome />
      </View>
    </ConfigDirectorProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
