import { describe, test, expect } from "vitest";
import { assignPercentage } from "../src/percent-hashing";

describe("assignPercentage", () => {

  test("assigns a stable percentage using rapidhash", () => {
      expect(assignPercentage({configId: "1", contextIdentifier: "abc"})).toEqual(51.0);
      expect(assignPercentage({configId: "1000", contextIdentifier: "abc"})).toEqual(3.9);
      expect(assignPercentage({configId: "2000", contextIdentifier: "378368375"})).toEqual(54.3);
      expect(assignPercentage({configId: "1000", contextIdentifier: "378368376"})).toEqual(89.4);
  });
});
