export const ConfigTypeList = [
  "custom",
  "boolean",
  "string",
  "integer",
  "float",
  "enum",
  "url",
  "json",
] as const;
export type ConfigType = (typeof ConfigTypeList)[number];

export type ConfigEnumLikeType = { [key: string]: string | number };

export type ConfigValueType = string | number | boolean | object | ConfigEnumLikeType;

export type ConfigState = {
  id: string;
  key: string;
  type: ConfigType;
  value: string | undefined | null;
  valueId?: string | undefined | null;
};

export type IdentifyingSdkOptions = {
  sdkName: string;
  sdkVersion: string;
};

export type ConfigDirectorLoggingLevel = "debug" | "info" | "warn" | "error" | "off";

export interface ConfigDirectorLogger {
  debug(message: string, ...args: any): void;

  info(message: string, ...args: any): void;

  warn(message: string, ...args: any): void;

  error(message: string, ...args: any): void;
}

export interface ConfigDirectorLogMessageDecorator {
  decorateMessage(message: string): string;
}

export type EvaluationReason =
  | "found-match"
  | "config-state-missing"
  | "client-not-ready"
  | "type-mismatch"
  | "value-missing"
  | "invalid-number"
  | "invalid-json"
  | "invalid-boolean";

/**
 * The user's context to be sent to ConfigDirector. This context will be used for targeting
 * rules evaluation.
 */
export type ConfigDirectorContext = {
  /**
   * The user's identifier. This should be a value that uniquely identifies an application
   * user.
   * In the case of anonymous users, you could generate a UUID or alternatively not provide
   * the {@link id} and the SDK will generate a random UUID. However, keep in mind that this
   * value is used for segmenting users in percentage rollouts, and changes to the {@link id}
   * could result in the user being assigned to a different percentile.
   */
  id?: string;

  /**
   * The user's display name. This will be shown in the ConfigDirector dashboard and may be
   * used for targeting rules.
   */
  name?: string;

  /**
   * Any arbitrary traits for the current user. They will be shown in the ConfigDirector
   * dashboard and may be used for targeting rules.
   */
  traits?: { [key: string]: unknown };

  /**
   * Whether or not to treat the context as anonymous during evaluation. When `true`, the
   * context values will be used for targeting rules evaluation but the context will not be
   * persisted and will not appear in the dashboard.
   *
   * @default false
   */
  anonymous?: boolean;
};

/**
 * Metadata about your application. It is recommended you include these values when configuring
 * a ConfigDirector client so that you can use them in targeting rules.
 */
export type ConfigDirectorMetaContext = {
  appVersion?: string;
  appName?: string;
};

export type ConnectionMode = "streaming" | "polling" | "one-time";
