import type { ConfigState, ConfigValueType, EvaluationReason } from "./types";

type NativeType = "string" | "number" | "bigint" | "boolean" | "symbol" | "undefined" | "object" | "function";

type ParseResult<T extends ConfigValueType> = {
  parsedValue: T;
  parsedValueId: string | null | undefined;
  requestedType: NativeType | string;
  usedDefault: boolean;
  reason: EvaluationReason;
};

export const getRequestedType = <T extends ConfigValueType>(defaultValue: T): string => {
  const baseType = typeof defaultValue;
  if (baseType === "object") {
    try {
      return (defaultValue as object).constructor?.name ?? baseType;
    } catch {
      return baseType;
    }
  } else if (baseType === "function") {
    try {
      const functionName = (defaultValue as any).name;
      return functionName ? `function: ${functionName}` : baseType;
    } catch {
      return baseType;
    }
  }
  return baseType;
};

const isNumericNativeType = (requestedType: NativeType): boolean => {
  return requestedType === "number" || requestedType === "bigint";
};

export const parseConfigValue = <T extends ConfigValueType>(
  configState: ConfigState,
  defaultValue: T,
): ParseResult<T> => {
  const value = configState.value;
  const requestedType = getRequestedType(defaultValue);

  if (value == null) {
    return {
      parsedValue: defaultValue as T,
      parsedValueId: undefined,
      requestedType,
      usedDefault: true,
      reason: "value-missing",
    };
  }

  if (configState.type === "json") {
    return parseJson(value, defaultValue, requestedType, configState.valueId);
  }

  if (typeof defaultValue === "string") {
    return {
      parsedValue: value as T,
      parsedValueId: configState.valueId,
      requestedType,
      usedDefault: false,
      reason: "found-match",
    };
  }

  if (
    typeof defaultValue === "boolean" &&
    (configState.type === "boolean" || configState.type === "string" || configState.type === "enum")
  ) {
    const boolValue = parseConfigBoolean(value);
    const hasBoolean = typeof boolValue === "boolean";
    return {
      parsedValue: (hasBoolean ? boolValue : defaultValue) as T,
      parsedValueId: hasBoolean ? configState.valueId : undefined,
      requestedType,
      usedDefault: !hasBoolean,
      reason: hasBoolean ? "found-match" : "invalid-boolean",
    };
  }

  if (isNumericNativeType(typeof defaultValue) && configState.type === "integer") {
    const numValue = parseConfigInteger(value);
    const hasNumber = typeof numValue === "number";
    return {
      parsedValue: (hasNumber ? numValue : defaultValue) as T,
      parsedValueId: hasNumber ? configState.valueId : undefined,
      requestedType,
      usedDefault: !hasNumber,
      reason: hasNumber ? "found-match" : "invalid-number",
    };
  }
  if (
    isNumericNativeType(typeof defaultValue) &&
    (configState.type === "float" || configState.type === "enum" || configState.type === "string")
  ) {
    const numValue = parseConfigFloat(value);
    const hasNumber = typeof numValue === "number";
    return {
      parsedValue: (hasNumber ? numValue : defaultValue) as T,
      parsedValueId: hasNumber ? configState.valueId : undefined,
      requestedType,
      usedDefault: !hasNumber,
      reason: hasNumber ? "found-match" : "invalid-number",
    };
  }

  return {
    parsedValue: defaultValue,
    parsedValueId: undefined,
    requestedType,
    usedDefault: true,
    reason: "type-mismatch",
  };
};

const parseConfigBoolean = (value: string): boolean | undefined => {
  if (!value) {
    return;
  }
  const lowerValue = value.toLowerCase();
  if (lowerValue != "true" && lowerValue != "false") {
    return;
  }
  return lowerValue === "true";
};

const parseConfigInteger = (value: string): number | undefined => {
  const num = parseStrictNumber(value);
  return num == null ? undefined : Math.trunc(num);
};

const parseConfigFloat = (value: string): number | undefined => {
  return parseStrictNumber(value);
};

const parseStrictNumber = (value: string): number | undefined => {
  if (!value || !isDecimalCharacters(value)) {
    return;
  }
  const num = Number(value);
  if (isNaN(num) || !isFinite(num)) {
    return;
  }
  return num;
};

const isDecimalCharacters = (value: string): boolean => {
  for (const character of value) {
    const isDigit = character >= "0" && character <= "9";
    if (!isDigit && !"+-.eE".includes(character)) {
      return false;
    }
  }
  return true;
};

const parseJson = <T extends ConfigValueType>(
  jsonString: string,
  defaultValue: T,
  requestedType: string,
  valueId: string | null | undefined,
): ParseResult<T> => {
  if (typeof defaultValue === "string") {
    return {
      parsedValue: jsonString as T,
      parsedValueId: valueId,
      requestedType,
      usedDefault: false,
      reason: "found-match",
    };
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (!isJsonTypeCompatible(parsed, defaultValue)) {
      return {
        parsedValue: defaultValue,
        parsedValueId: undefined,
        requestedType,
        usedDefault: true,
        reason: "type-mismatch",
      };
    }
    return {
      parsedValue: parsed,
      parsedValueId: valueId,
      requestedType,
      usedDefault: false,
      reason: "found-match",
    };
  } catch {
    return {
      parsedValue: defaultValue,
      parsedValueId: undefined,
      requestedType,
      usedDefault: true,
      reason: "invalid-json",
    };
  }
};

const isJsonTypeCompatible = (parsed: unknown, defaultValue: ConfigValueType): boolean => {
  if (parsed === null) {
    return false;
  }
  const defaultType = typeof defaultValue;
  if (defaultType === "bigint") {
    return typeof parsed === "number";
  }
  return typeof parsed === defaultType;
};
