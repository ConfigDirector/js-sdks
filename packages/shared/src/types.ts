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
  | "invalid-boolean"
  | "cached";

export type ConfigEvaluation = {
  key: string;
  value: ConfigValueType;
  valueId?: string;
  isDefaultValue: boolean;
  reason: EvaluationReason;
  context?: ConfigDirectorContext;
};
/**
 * The context to be sent to ConfigDirector: the user or other entity, such as a device or an
 * organization, that configs are evaluated for. This context will be used for targeting rules
 * evaluation.
 */
export type ConfigDirectorContext = {
  /**
   * The context's identifier. This should be a value that uniquely identifies the user or other
   * entity among contexts of the same {@link kind}.
   * In the case of anonymous users, you could generate a UUID or alternatively not provide
   * the {@link id}. In a client SDK, ConfigDirector then derives an identifier from an ID the SDK
   * stores for the app install or the website, so it stays the same until the app is uninstalled
   * or the site's data is cleared. However, keep in mind that this value is used for segmenting
   * contexts in percentage rollouts, and changes to the {@link id} could result in the context
   * being assigned to a different percentile.
   */
  id?: string;

  /**
   * The kind of entity this context represents, such as `user`, `device`, `organization`,
   * `tenant` or `listing`. You can use any other kind that fits your application. A kind has 1
   * to 64 characters, using only lowercase letters (`a`-`z`), digits, `-` and `_`. It is used
   * exactly as given, without trimming or changing its case.
   *
   * A context with an invalid kind is ignored as a whole: the SDK logs an error and evaluates
   * as if no context had been provided.
   *
   * @default "user"
   */
  kind?: string;

  /**
   * The context's display name. This will be shown in the ConfigDirector dashboard and may be
   * used for targeting rules.
   */
  name?: string;

  /**
   * Any arbitrary traits for the context. They will be shown in the ConfigDirector dashboard
   * and may be used for targeting rules.
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

export type ConnectionMode = "streaming" | "polling" | "offline";
