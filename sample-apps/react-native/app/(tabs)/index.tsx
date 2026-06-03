import { ScrollView, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useConfigValue } from "@configdirector/react-native-sdk";

export default function FlagsScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const temporaryFeatureFlag = useConfigValue("temporary-feature-flag", true);
  const permanentKillSwitch = useConfigValue("permanent-kill-switch", false);
  const integerConfig = useConfigValue("integer-config", "10");
  const dayOfTheWeekConfig = useConfigValue("day-of-the-week-config", "Friday");
  const jsonValueConfig = useConfigValue("json-value-config", {});

  const cardStyle = [
    styles.flagCard,
    {
      borderColor: colors.icon + "30",
      backgroundColor: colorScheme === "dark" ? "#1e2021" : "#f8f9fa",
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Feature Flags
        </ThemedText>

        <View style={cardStyle}>
          <View style={styles.flagInfo}>
            <ThemedText type="defaultSemiBold">temporary-feature-flag</ThemedText>
            <ThemedText style={[styles.flagKey, { color: colors.icon }]}>temporary-feature-flag</ThemedText>
          </View>
          <View
            style={[styles.badge, { backgroundColor: temporaryFeatureFlag.value ? "#4caf50" : "#9e9e9e" }]}>
            <ThemedText style={styles.badgeText}>{temporaryFeatureFlag.value ? "ON" : "OFF"}</ThemedText>
          </View>
        </View>

        <View style={cardStyle}>
          <View style={styles.flagInfo}>
            <ThemedText type="defaultSemiBold">permanent-kill-switch</ThemedText>
            <ThemedText style={[styles.flagKey, { color: colors.icon }]}>permanent-kill-switch</ThemedText>
          </View>
          <View
            style={[styles.badge, { backgroundColor: permanentKillSwitch.value ? "#4caf50" : "#9e9e9e" }]}>
            <ThemedText style={styles.badgeText}>{permanentKillSwitch.value ? "ON" : "OFF"}</ThemedText>
          </View>
        </View>

        <View style={cardStyle}>
          <View style={styles.flagInfo}>
            <ThemedText type="defaultSemiBold">integer-config</ThemedText>
            <ThemedText style={[styles.flagKey, { color: colors.icon }]}>integer-config</ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.tint }]}>
            <ThemedText style={styles.badgeText}>{integerConfig.value}</ThemedText>
          </View>
        </View>

        <View style={cardStyle}>
          <View style={styles.flagInfo}>
            <ThemedText type="defaultSemiBold">day-of-the-week-config</ThemedText>
            <ThemedText style={[styles.flagKey, { color: colors.icon }]}>day-of-the-week-config</ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.tint }]}>
            <ThemedText style={styles.badgeText}>{dayOfTheWeekConfig.value}</ThemedText>
          </View>
        </View>

        <View style={[...cardStyle, styles.jsonCard]}>
          <View style={styles.flagInfo}>
            <ThemedText type="defaultSemiBold">json-value-config</ThemedText>
            <ThemedText style={[styles.flagKey, { color: colors.icon }]}>json-value-config</ThemedText>
          </View>
          <ThemedText
            style={[styles.jsonValue, { borderColor: colors.icon + "30", color: colors.icon }]}>
            {JSON.stringify(jsonValueConfig.value, null, 2)}
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  flagCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  flagInfo: {
    flex: 1,
    marginRight: 12,
  },
  flagKey: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: "monospace",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 48,
    alignItems: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  jsonCard: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  jsonValue: {
    marginTop: 10,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 18,
    width: "100%",
  },
});
