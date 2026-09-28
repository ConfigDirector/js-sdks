import { describe, expect, test } from "@jest/globals";
import { readAppInfo } from "../src/appInfo";

describe("readAppInfo", () => {
  test("reads the name and version expo-application reports", () => {
    const appInfo = readAppInfo({
      expoModules: { ExpoApplication: { applicationName: "Checkout", nativeApplicationVersion: "4.2.0" } },
    });

    expect(appInfo).toEqual({ appName: "Checkout", appVersion: "4.2.0" });
  });

  test("reads the name and version react-native-device-info reports", () => {
    const appInfo = readAppInfo({
      nativeModules: { RNDeviceInfo: { appName: "Checkout", appVersion: "4.2.0" } },
    });

    expect(appInfo).toEqual({ appName: "Checkout", appVersion: "4.2.0" });
  });

  test("reads react-native-device-info constants through getConstants when it has them", () => {
    const appInfo = readAppInfo({
      nativeModules: { RNDeviceInfo: { getConstants: () => ({ appName: "Checkout", appVersion: "4.2.0" }) } },
    });

    expect(appInfo).toEqual({ appName: "Checkout", appVersion: "4.2.0" });
  });

  test("prefers expo-application over react-native-device-info", () => {
    const appInfo = readAppInfo({
      expoModules: { ExpoApplication: { applicationName: "Expo Checkout", nativeApplicationVersion: "5.0.0" } },
      nativeModules: { RNDeviceInfo: { appName: "Checkout", appVersion: "4.2.0" } },
    });

    expect(appInfo).toEqual({ appName: "Expo Checkout", appVersion: "5.0.0" });
  });

  test("takes a field from the next source when the first reports it blank", () => {
    const appInfo = readAppInfo({
      expoModules: { ExpoApplication: { applicationName: "  ", nativeApplicationVersion: "5.0.0" } },
      nativeModules: { RNDeviceInfo: { appName: "Checkout", appVersion: "4.2.0" } },
    });

    expect(appInfo).toEqual({ appName: "Checkout", appVersion: "5.0.0" });
  });

  test("leaves a field unset when no source reports it as a string", () => {
    const appInfo = readAppInfo({
      expoModules: { ExpoApplication: { applicationName: 42, nativeApplicationVersion: null } },
      nativeModules: { RNDeviceInfo: { appName: undefined } },
    });

    expect(appInfo).toEqual({});
  });

  test("leaves both unset when neither module is installed", () => {
    expect(readAppInfo({ expoModules: undefined, nativeModules: {} })).toEqual({});
    expect(readAppInfo({})).toEqual({});
  });

  test("leaves both unset when reading a module throws", () => {
    const appInfo = readAppInfo({
      nativeModules: {
        RNDeviceInfo: {
          getConstants: () => {
            throw new Error("not on this thread");
          },
        },
      },
    });

    expect(appInfo).toEqual({});
  });
});
