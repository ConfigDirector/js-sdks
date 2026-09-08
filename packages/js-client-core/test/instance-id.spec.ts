import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resolveInstanceId } from "../src/instance-id";
import { createStubbedLogger } from "./helpers";

const STORAGE_KEY = "configdirector-sdk:instance-id";
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const logger = createStubbedLogger();

const readRecord = () => JSON.parse(localStorage.getItem(STORAGE_KEY) as string);

const writeRecord = (record: unknown) => localStorage.setItem(STORAGE_KEY, JSON.stringify(record));

const checksumOf = (id: string, createdAt: number) => {
  localStorage.clear();
  const now = vi.spyOn(Date, "now").mockReturnValue(createdAt);
  vi.stubGlobal("crypto", { randomUUID: () => id });
  resolveInstanceId(logger);
  vi.unstubAllGlobals();
  now.mockRestore();
  const checksum = readRecord().checksum;
  localStorage.clear();
  return checksum;
};

describe("resolveInstanceId", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  test("generates an instance id and persists it with its creation timestamp when none is stored", () => {
    vi.setSystemTime(1_700_000_000_000);

    const instanceId = resolveInstanceId(logger);

    expect(instanceId).toMatch(UUID_V4_PATTERN);
    expect(readRecord()).toMatchObject({ v: 1, id: instanceId, createdAt: 1_700_000_000_000 });
    expect(readRecord().checksum).toEqual(expect.any(String));
  });

  test("reuses the stored instance id when it was generated less than 6 hours ago", () => {
    vi.setSystemTime(1_700_000_000_000);
    const instanceId = resolveInstanceId(logger);
    const storedRecord = readRecord();

    vi.setSystemTime(1_700_000_000_000 + (6 * 60 - 1) * 60 * 1_000);

    expect(resolveInstanceId(logger)).toBe(instanceId);
    expect(readRecord()).toEqual(storedRecord);
  });

  test("generates and stores a new instance id when the stored one is 6 hours old", () => {
    vi.setSystemTime(1_700_000_000_000);
    const instanceId = resolveInstanceId(logger);

    vi.setSystemTime(1_700_000_000_000 + 6 * 60 * 60 * 1_000);
    const newInstanceId = resolveInstanceId(logger);

    expect(newInstanceId).not.toBe(instanceId);
    expect(newInstanceId).toMatch(UUID_V4_PATTERN);
    expect(readRecord()).toMatchObject({
      id: newInstanceId,
      createdAt: 1_700_000_000_000 + 6 * 60 * 60 * 1_000,
    });
  });

  test("generates a new instance id when the stored creation timestamp is in the future", () => {
    vi.setSystemTime(1_700_000_000_000);
    const instanceId = resolveInstanceId(logger);

    vi.setSystemTime(1_700_000_000_000 - 1_000);

    expect(resolveInstanceId(logger)).not.toBe(instanceId);
  });

  test("ignores a stored instance id whose checksum does not match the stored values", () => {
    vi.setSystemTime(1_700_000_000_000);
    const instanceId = resolveInstanceId(logger);
    const tampered = { ...readRecord(), id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
    writeRecord(tampered);

    const resolved = resolveInstanceId(logger);

    expect(resolved).not.toBe(tampered.id);
    expect(resolved).not.toBe(instanceId);
    expect(readRecord().id).toBe(resolved);
  });

  test("ignores a stored record whose creation timestamp was extended without updating the checksum", () => {
    vi.setSystemTime(1_700_000_000_000);
    resolveInstanceId(logger);
    const record = readRecord();
    writeRecord({ ...record, createdAt: record.createdAt + 6 * 60 * 60 * 1_000 });

    vi.setSystemTime(1_700_000_000_000 + 9 * 60 * 60 * 1_000);

    expect(resolveInstanceId(logger)).not.toBe(record.id);
  });

  test.each([
    ["not an object", '"just-a-string"'],
    ["malformed JSON", "{"],
    ["an empty string", ""],
  ])("generates a new instance id when the stored value is %s", (_name, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);

    expect(resolveInstanceId(logger)).toMatch(UUID_V4_PATTERN);
  });

  test.each([
    ["not a UUID", "not-a-uuid"],
    ["a UUID of the wrong version", "aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa"],
    ["a UUID with an invalid variant", "aaaaaaaa-aaaa-4aaa-caaa-aaaaaaaaaaaa"],
    ["a UUID with a missing section", "aaaaaaaa-4aaa-8aaa-aaaaaaaaaaaa"],
    ["a UUID with trailing characters", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaaa"],
  ])("generates a new instance id when the stored id is %s", (_name, id) => {
    const createdAt = 1_700_000_000_000;
    writeRecord({ v: 1, id, createdAt, checksum: checksumOf(id, createdAt) });
    vi.setSystemTime(createdAt);

    const resolved = resolveInstanceId(logger);

    expect(resolved).not.toBe(id);
    expect(resolved).toMatch(UUID_V4_PATTERN);
  });

  test("generates a new instance id when the stored record has an unknown version", () => {
    vi.setSystemTime(1_700_000_000_000);
    resolveInstanceId(logger);
    const record = readRecord();
    writeRecord({ ...record, v: 2 });

    expect(resolveInstanceId(logger)).not.toBe(record.id);
  });

  test.each([
    ["a non-integer", 1_700_000_000_000.5, 1_700_000_000_001.5],
    ["a string", "1700000000000", 1_700_000_000_000],
    ["zero", 0, 0],
    ["negative", -1_000, 0],
  ])(
    "generates a new instance id when the stored creation timestamp is %s",
    (_name, createdAt, now: number) => {
      const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      writeRecord({ v: 1, id, createdAt, checksum: checksumOf(id, createdAt as number) });
      vi.setSystemTime(now);

      expect(resolveInstanceId(logger)).not.toBe(id);
    },
  );

  test("generates a new instance id without persisting it when localStorage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);

    const instanceId = resolveInstanceId(logger);

    expect(instanceId).toMatch(UUID_V4_PATTERN);
    expect(resolveInstanceId(logger)).not.toBe(instanceId);
  });

  test("generates a new instance id when localStorage does not implement getItem or setItem", () => {
    vi.stubGlobal("localStorage", {});

    expect(resolveInstanceId(logger)).toMatch(UUID_V4_PATTERN);
  });

  test("generates a new instance id when accessing localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      get getItem() {
        throw new Error("access denied");
      },
    });

    expect(resolveInstanceId(logger)).toMatch(UUID_V4_PATTERN);
  });

  test("generates a new instance id when reading from localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("access denied");
      },
      setItem: () => {},
    });

    expect(resolveInstanceId(logger)).toMatch(UUID_V4_PATTERN);
  });

  test("still returns an instance id when writing to localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    });

    expect(resolveInstanceId(logger)).toMatch(UUID_V4_PATTERN);
  });
});
