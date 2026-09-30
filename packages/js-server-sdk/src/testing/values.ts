import type { ConfigDefinition } from "../types";
import { encodeTestValue as encodeShared } from "@shared/testing/values";
import type { TestValue } from "@shared/testing/values";

export type { TestJsonValue, TestValue, TestValues } from "@shared/testing/values";

export const encodeTestValue = (key: string, value: TestValue): ConfigDefinition => {
  const encoded = encodeShared(key, value);
  return {
    id: `test-config:${key}`,
    key,
    type: encoded.type,
    variations: [{ name: null, value: encoded.value }],
    target: { defaultValue: encoded.value, rules: [] },
  };
};
