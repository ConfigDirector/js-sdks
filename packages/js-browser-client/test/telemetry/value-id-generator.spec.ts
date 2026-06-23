import { describe, expect, test } from "vitest";
import { generateValueId } from "../../src/telemetry/value-id-generator";

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

describe("ValueIdGenerator", () => {
  test("output is always 22 characters", async () => {
    expect(await generateValueId("value")).toHaveLength(22);
  });

  test("output only contains base62 characters", async () => {
    const result = await generateValueId("hello");
    expect([...result].every((c) => BASE62.includes(c))).toBe(true);
  });

  test("is deterministic", async () => {
    expect(await generateValueId("my-value")).toEqual(await generateValueId("my-value"));
  });

  test("different values produce different ids", async () => {
    expect(await generateValueId("value-a")).not.toEqual(await generateValueId("value-b"));
  });

  test.each([
    ["hello", "1MoOW7eqAPjhZeoELVwO9G"],
    ["world", "2Cg0gndCS8p6nDE5aa6LcI"],
    ["42", "3VWjGpOwynZPh07ivDC56c"],
    ["", "6ve2WrOl3mnciB6WIL2fIa"],
  ])("produces known output for %j", async (input, expected) => {
    expect(await generateValueId(input)).toBe(expected);
  });
});
