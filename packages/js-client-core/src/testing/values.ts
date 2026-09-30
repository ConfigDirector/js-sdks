import type { ConfigState } from "../types";
import { encodeTestValue as encodeShared } from "@shared/testing/values";
import type { TestValue } from "@shared/testing/values";

export type { TestJsonValue, TestValue, TestValues } from "@shared/testing/values";

export const encodeTestValue = (key: string, value: TestValue, revision: number): ConfigState => {
  const encoded = encodeShared(key, value);
  return {
    id: `test-config:${key}`,
    key,
    type: encoded.type,
    value: encoded.value,
    valueId: `test-value:${key}:${revision}`,
  };
};
