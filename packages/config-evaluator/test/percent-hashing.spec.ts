import { describe, test, expect } from "vitest";
import { assignPercentage } from "../src/percent-hashing";

describe("assignPercentage", () => {

  test("assigns a stable percentage using rapidhash", () => {
      expect(assignPercentage({configId: "00000000-0000-0000-0000-000000000001", contextIdentifier: "abc"})).toEqual(61.8);
      expect(assignPercentage({configId: "00000000-0000-0000-0000-0000000003e8", contextIdentifier: "abc"})).toEqual(34.0);
      expect(assignPercentage({configId: "00000000-0000-0000-0000-0000000007d0", contextIdentifier: "378368375"})).toEqual(13.5);
      expect(assignPercentage({configId: "00000000-0000-0000-0000-0000000003e8", contextIdentifier: "378368376"})).toEqual(66.0);
  });
});
