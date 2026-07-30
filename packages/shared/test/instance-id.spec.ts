import { describe, test, expect, vi, afterEach } from "vitest";
import { generateInstanceId } from "../src/instance-id";

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateInstanceId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("uses crypto.randomUUID when it is available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-4111-8111-111111111111" });

    expect(generateInstanceId()).toBe("11111111-1111-4111-8111-111111111111");
  });

  test("falls back to a locally generated id when crypto is unavailable (e.g. Hermes/React Native)", () => {
    vi.stubGlobal("crypto", undefined);

    expect(() => generateInstanceId()).not.toThrow();
    expect(generateInstanceId()).toMatch(UUID_V4_PATTERN);
  });
});
