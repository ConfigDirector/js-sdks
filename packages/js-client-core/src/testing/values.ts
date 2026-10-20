import type { ConfigState } from "../types";
import { encodeNativeValue } from "@shared/native-values";
import type { NativeValue } from "@shared/native-values";

export type {
  NativeJsonValue as TestJsonValue,
  NativeValue as TestValue,
  NativeValues as TestValues,
} from "@shared/native-values";

export const encodeTestValue = (key: string, value: NativeValue, revision: number): ConfigState => {
  const encoded = encodeNativeValue(key, value);
  return {
    id: `test-config:${key}`,
    key,
    type: encoded.type,
    value: encoded.value,
    valueId: `test-value:${key}:${revision}`,
  };
};
