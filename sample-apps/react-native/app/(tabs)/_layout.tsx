import { Image } from "expo-image";
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

function HeaderLogo() {
  return (
    <Image
      source={require("@/assets/images/ConfigDirector-Logo-LightMode.svg")}
      style={styles.logo}
      contentFit="contain"
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 180,
    height: 32,
  },
});

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        headerShown: true,
        headerTitle: () => <HeaderLogo />,
        headerStyle: { backgroundColor: "#ffffff" },
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Flags",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="flag.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "Context",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
