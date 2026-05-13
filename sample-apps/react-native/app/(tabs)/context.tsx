import { useState } from "react";
import { Keyboard, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useContext } from "@configdirector/react-native-sdk";

export default function ContextScreen() {
  const colorScheme = useColorScheme() ?? "light";
  const colors = Colors[colorScheme];

  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");

  const savedOpacity = useSharedValue(0);
  const savedStyle = useAnimatedStyle(() => ({ opacity: savedOpacity.value }));
  const clearedOpacity = useSharedValue(0);
  const clearedStyle = useAnimatedStyle(() => ({ opacity: clearedOpacity.value }));
  const { updateContext } = useContext();

  const fadeIn = (value: ReturnType<typeof useSharedValue<number>>) => {
    value.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(1, { duration: 1600 }),
      withTiming(0, { duration: 400 }),
    );
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    await updateContext({ id: userId, name: userName, traits: { role: userRole } });
    fadeIn(savedOpacity);
  };

  const handleClear = async () => {
    Keyboard.dismiss();
    setUserId("");
    setUserName("");
    setUserRole("");
    await updateContext({});
    fadeIn(clearedOpacity);
  };

  const inputStyle = [
    styles.input,
    {
      borderColor: colors.icon + "50",
      color: colors.text,
      backgroundColor: colorScheme === "dark" ? "#1e2021" : "#f8f9fa",
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle" style={styles.title}>
          Context
        </ThemedText>
        <ThemedText style={[styles.description, { color: colors.icon }]}>
          Configure the context sent to ConfigDirector when evaluating feature flags.
        </ThemedText>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              User ID
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={userId}
              onChangeText={setUserId}
              placeholder="e.g. user-123"
              placeholderTextColor={colors.icon}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              User Name
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={userName}
              onChangeText={setUserName}
              placeholder="e.g. Jane Smith"
              placeholderTextColor={colors.icon}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>

          <View style={styles.fieldGroup}>
            <ThemedText type="defaultSemiBold" style={styles.label}>
              User Role
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={userRole}
              onChangeText={setUserRole}
              placeholder="e.g. admin, viewer, editor"
              placeholderTextColor={colors.icon}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
        </View>

        <View style={styles.saveRow}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: colors.tint }]}
            onPress={handleSave}
            activeOpacity={0.75}>
            <ThemedText style={styles.saveButtonText}>Save</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, styles.clearButton, { borderColor: colors.icon + "50" }]}
            onPress={handleClear}
            activeOpacity={0.75}>
            <ThemedText style={[styles.saveButtonText, { color: colors.text }]}>Clear</ThemedText>
          </TouchableOpacity>
        </View>
        <View style={styles.confirmationContainer}>
          <Animated.Text style={[styles.savedConfirmation, savedStyle]}>Context saved</Animated.Text>
          <Animated.Text style={[styles.savedConfirmation, styles.clearedConfirmation, clearedStyle]}>Context cleared</Animated.Text>
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
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 28,
  },
  form: {
    gap: 20,
  },
  fieldGroup: {
    gap: 6,
  },
  label: {
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  saveRow: {
    marginTop: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  saveButton: {
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 10,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  clearButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderRadius: 10,
  },
  savedConfirmation: {
    fontSize: 14,
    color: "#4caf50",
  },
  confirmationContainer: {
    marginTop: 12,
    height: 20,
  },
  clearedConfirmation: {
    position: "absolute",
    color: "#9e9e9e",
  },
});
