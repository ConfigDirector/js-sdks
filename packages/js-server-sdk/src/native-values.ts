import type { ConfigDefinition } from "./types";
import { encodeNativeValue, type NativeValue } from "@shared/native-values";

export const unconditionalConfig = (id: string, key: string, value: NativeValue): ConfigDefinition => {
  const encoded = encodeNativeValue(key, value);
  return {
    id,
    key,
    type: encoded.type,
    variations: [{ name: null, value: encoded.value }],
    target: { defaultValue: encoded.value, rules: [] },
  };
};
