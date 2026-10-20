import type { ConfigState } from "./types";
import { encodeNativeValue, type NativeValue } from "@shared/native-values";

export const nativeValueConfigState = (
  id: string,
  key: string,
  value: NativeValue,
  valueId: string | undefined,
): ConfigState => {
  const encoded = encodeNativeValue(key, value);
  return { id, key, type: encoded.type, value: encoded.value, valueId };
};
