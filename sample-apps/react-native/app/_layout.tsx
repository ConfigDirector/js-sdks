import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  ConfigDirectorProvider,
  createConsoleLogger,
} from "@configdirector/react-native-sdk";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

const sdkKey = process.env.EXPO_PUBLIC_CONFIGDIRECTOR_SDK_KEY ?? "";
const logger = createConsoleLogger("debug");

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ConfigDirectorProvider sdkKey={sdkKey} logger={logger}>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </ConfigDirectorProvider>
  );
}
