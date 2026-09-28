import { NativeModules } from "react-native";
import type { ConfigDirectorLogger, ConfigDirectorMetaContext } from "@shared/types";

type ModuleConstants = Record<string, unknown>;

type NativeModule = ModuleConstants & { getConstants?: () => ModuleConstants };

export type AppInfoSources = {
  expoModules?: Record<string, unknown>;
  nativeModules?: Record<string, unknown>;
};

type AppInfoField = "appName" | "appVersion";

type AppInfoSource = {
  module: (sources: AppInfoSources) => unknown;
  constantNames: Record<AppInfoField, string>;
};

const APP_INFO_SOURCES: AppInfoSource[] = [
  {
    module: (sources) => sources.expoModules?.ExpoApplication,
    constantNames: { appName: "applicationName", appVersion: "nativeApplicationVersion" },
  },
  {
    module: (sources) => sources.nativeModules?.RNDeviceInfo,
    constantNames: { appName: "appName", appVersion: "appVersion" },
  },
];

const constantsOf = (module: unknown): ModuleConstants | undefined => {
  if (typeof module !== "object" || module === null) {
    return undefined;
  }
  const nativeModule = module as NativeModule;
  try {
    return typeof nativeModule.getConstants === "function" ? nativeModule.getConstants() : nativeModule;
  } catch {
    return undefined;
  }
};

const nonBlankString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;

export const readAppInfo = (sources: AppInfoSources): ConfigDirectorMetaContext => {
  const reported = APP_INFO_SOURCES.map((source) => ({
    constantNames: source.constantNames,
    constants: constantsOf(source.module(sources)),
  }));
  const firstReported = (field: AppInfoField): string | undefined =>
    reported
      .map(({ constantNames, constants }) => nonBlankString(constants?.[constantNames[field]]))
      .find((value) => value !== undefined);

  const appName = firstReported("appName");
  const appVersion = firstReported("appVersion");
  return {
    ...(appName !== undefined && { appName }),
    ...(appVersion !== undefined && { appVersion }),
  };
};

type ExpoGlobal = { expo?: { modules?: Record<string, unknown> } };

const platformAppInfoSources = (): AppInfoSources => ({
  expoModules: (globalThis as ExpoGlobal).expo?.modules,
  nativeModules: NativeModules as Record<string, unknown>,
});

export const resolveMetadata = (
  provided: ConfigDirectorMetaContext | undefined,
  logger: ConfigDirectorLogger,
): ConfigDirectorMetaContext => {
  const bothProvided = provided?.appName !== undefined && provided?.appVersion !== undefined;
  const detected = bothProvided ? {} : readAppInfo(platformAppInfoSources());
  const metadata: ConfigDirectorMetaContext = {
    appName: provided?.appName ?? detected.appName,
    appVersion: provided?.appVersion ?? detected.appVersion,
  };

  const missing = [
    ...(metadata.appName === undefined ? ["name"] : []),
    ...(metadata.appVersion === undefined ? ["version"] : []),
  ];
  if (missing.length > 0) {
    const pronoun = missing.length === 1 ? "it" : "them";
    logger.info(
      `The ConfigDirector SDK could not find an app ${missing.join(" and ")}, so targeting rules that use ${pronoun} will not match. ` +
        `Provide ${pronoun} through the appName and appVersion props of ConfigDirectorProvider or the metadata option of createClient, ` +
        `or install expo-application or react-native-device-info for the SDK to read ${pronoun} from.`,
    );
  }
  return metadata;
};
