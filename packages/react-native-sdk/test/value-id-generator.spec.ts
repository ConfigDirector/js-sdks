import { describe, expect, test } from "@jest/globals";
import { generateValueId as generateValueIdShared } from "@shared/value-id-generator";
import { generateValueId } from "../src/value-id-generator";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

describe("generateValueId (React Native)", () => {
  test("output is always 22 characters", () => {
    expect(generateValueId("value")).toHaveLength(22);
  });

  test("output only contains base62 characters", () => {
    const result = generateValueId("hello");
    expect([...result].every((c) => BASE62.includes(c))).toBe(true);
  });

  test("is deterministic", () => {
    expect(generateValueId("my-value")).toEqual(generateValueId("my-value"));
  });

  test("different values produce different ids", () => {
    expect(generateValueId("value-a")).not.toEqual(generateValueId("value-b"));
  });

  test("handles non-string inputs", () => {
    expect(generateValueId(42)).toHaveLength(22);
    expect(generateValueId(true)).toHaveLength(22);
    expect(generateValueId(null)).toHaveLength(22);
    expect(generateValueId(undefined)).toHaveLength(22);
  });

  test.each([
    ["hello", "1MoOW7eqAPjhZeoELVwO9G"],
    ["world", "2Cg0gndCS8p6nDE5aa6LcI"],
    ["42", "3VWjGpOwynZPh07ivDC56c"],
    ["", "6ve2WrOl3mnciB6WIL2fIa"],
  ])("produces known output for %j", (input, expected) => {
    expect(generateValueId(input)).toBe(expected);
  });
});

describe("generateValueId cross-implementation parity", () => {
  const inputs = ["hello", "value", "my-value", "", "42", "true"];

  for (const input of inputs) {
    test(`shared and RN produce the same id for "${input}"`, async () => {
      expect(generateValueId(input)).toBe(await generateValueIdShared(input));
    });
  }
});
