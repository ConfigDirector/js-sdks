const expoPreset = require("jest-expo/jest-preset");

module.exports = {
  preset: "jest-expo",
  setupFiles: ["<rootDir>/test/jest-setup.js"],
  transform: { "\\.mjs$": expoPreset.transform["\\.[jt]sx?$"] },
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@configdirector|@noble))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
};
