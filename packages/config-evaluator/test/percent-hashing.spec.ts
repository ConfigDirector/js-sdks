import { describe, test, expect } from "vitest";
import { assignPercentage } from "../src/percent-hashing";

describe("assignPercentage", () => {
  test("assigns a stable percentage using rapidhash", () => {
    expect(
      assignPercentage({
        configId: "00000000-0000-0000-0000-000000000001",
        contextIdentifier: "abc",
        contextKind: "user",
      }),
    ).toEqual(61.8);
    expect(
      assignPercentage({
        configId: "00000000-0000-0000-0000-0000000003e8",
        contextIdentifier: "abc",
        contextKind: "user",
      }),
    ).toEqual(34.0);
    expect(
      assignPercentage({
        configId: "00000000-0000-0000-0000-0000000007d0",
        contextIdentifier: "378368375",
        contextKind: "user",
      }),
    ).toEqual(13.5);
    expect(
      assignPercentage({
        configId: "00000000-0000-0000-0000-0000000003e8",
        contextIdentifier: "378368376",
        contextKind: "user",
      }),
    ).toEqual(66.0);
  });

  test("assigns a user context from its identifier and the config id alone", () => {
    expect(
      assignPercentage({
        configId: "11111111-1111-4111-8111-111111111111",
        contextIdentifier: "user-1",
        contextKind: "user",
      }),
    ).toEqual(7.8);
  });

  test("assigns a device context from its identifier, the config id and its kind", () => {
    expect(
      assignPercentage({
        configId: "11111111-1111-4111-8111-111111111111",
        contextIdentifier: "user-1",
        contextKind: "device",
      }),
    ).toEqual(59.0);
  });

  test("assigns a tenant context from its identifier, the config id and its kind", () => {
    expect(
      assignPercentage({
        configId: "11111111-1111-4111-8111-111111111111",
        contextIdentifier: "user-1",
        contextKind: "tenant",
      }),
    ).toEqual(8.5);
  });
});
