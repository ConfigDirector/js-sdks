import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { resolveClientSession } from "../src/client-session";
import type { InstanceIdStorage } from "../src/types";
import { createCapturingLogger, createStubbedLogger, deferred, type Deferred } from "./helpers";

const STORAGE_KEY = "configdirector-sdk:instance-id";
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const logger = createStubbedLogger();

const readRecord = () => JSON.parse(localStorage.getItem(STORAGE_KEY) as string);

const writeRecord = (record: unknown) => localStorage.setItem(STORAGE_KEY, JSON.stringify(record));

const storedRecordFor = async (id: string, createdAt: number): Promise<string> => {
  localStorage.clear();
  const now = vi.spyOn(Date, "now").mockReturnValue(createdAt);
  vi.stubGlobal("crypto", { randomUUID: () => id });
  await resolveClientSession(logger);
  vi.unstubAllGlobals();
  now.mockRestore();
  const record = localStorage.getItem(STORAGE_KEY) as string;
  localStorage.clear();
  return record;
};

const checksumOf = async (id: string, createdAt: number) =>
  JSON.parse(await storedRecordFor(id, createdAt)).checksum;

const settlementOf = (promise: Promise<unknown>) => {
  const settlement = { settled: false };
  void promise.then(() => (settlement.settled = true));
  return settlement;
};

describe("resolveClientSession", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  describe("with the default localStorage adapter", () => {
    test("generates an instance id and persists it with its creation timestamp when none is stored", async () => {
      vi.setSystemTime(1_700_000_000_000);

      const session = await resolveClientSession(logger);

      expect(session).toEqual({ instanceId: expect.stringMatching(UUID_V4_PATTERN) });
      expect(readRecord()).toMatchObject({ v: 1, id: session.instanceId, createdAt: 1_700_000_000_000 });
      expect(readRecord().checksum).toEqual(expect.any(String));
    });

    test("reuses the stored instance id without rewriting it a year after it was generated", async () => {
      vi.setSystemTime(1_700_000_000_000);
      const { instanceId } = await resolveClientSession(logger);
      const storedRecord = readRecord();

      vi.setSystemTime(1_700_000_000_000 + 366 * 24 * 60 * 60 * 1_000);

      expect(await resolveClientSession(logger)).toEqual({ instanceId });
      expect(readRecord()).toEqual(storedRecord);
    });

    test("reuses the stored instance id without rewriting it when its creation timestamp is in the future", async () => {
      vi.setSystemTime(1_700_000_000_000);
      const { instanceId } = await resolveClientSession(logger);
      const storedRecord = readRecord();

      vi.setSystemTime(1_700_000_000_000 - 1_000);

      expect(await resolveClientSession(logger)).toEqual({ instanceId });
      expect(readRecord()).toEqual(storedRecord);
    });

    test("reuses an instance id stored by an earlier version of the SDK", async () => {
      const storedByEarlierVersion =
        '{"v":1,"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","createdAt":1760000000000,"checksum":"50773f6a1e3e9b5e"}';
      localStorage.setItem(STORAGE_KEY, storedByEarlierVersion);
      vi.setSystemTime(1_800_000_000_000);

      expect(await resolveClientSession(logger)).toEqual({ instanceId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });
      expect(localStorage.getItem(STORAGE_KEY)).toBe(storedByEarlierVersion);
    });

    test("ignores a stored instance id whose checksum does not match the stored values", async () => {
      vi.setSystemTime(1_700_000_000_000);
      const { instanceId } = await resolveClientSession(logger);
      const tampered = { ...readRecord(), id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
      writeRecord(tampered);

      const resolved = await resolveClientSession(logger);

      expect(resolved.instanceId).not.toBe(tampered.id);
      expect(resolved.instanceId).not.toBe(instanceId);
      expect(readRecord().id).toBe(resolved.instanceId);
    });

    test("ignores a stored record whose creation timestamp was changed without updating the checksum", async () => {
      vi.setSystemTime(1_700_000_000_000);
      await resolveClientSession(logger);
      const record = readRecord();
      writeRecord({ ...record, createdAt: record.createdAt + 1_000 });

      expect((await resolveClientSession(logger)).instanceId).not.toBe(record.id);
    });

    test.each([
      ["not an object", '"just-a-string"'],
      ["malformed JSON", "{"],
      ["an empty string", ""],
    ])("generates a new instance id when the stored value is %s", async (_name, raw) => {
      localStorage.setItem(STORAGE_KEY, raw);

      expect((await resolveClientSession(logger)).instanceId).toMatch(UUID_V4_PATTERN);
    });

    test.each([
      ["not a UUID", "not-a-uuid"],
      ["a UUID of the wrong version", "aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa"],
      ["a UUID with an invalid variant", "aaaaaaaa-aaaa-4aaa-caaa-aaaaaaaaaaaa"],
      ["a UUID with a missing section", "aaaaaaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      ["a UUID with trailing characters", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaaa"],
    ])("generates a new instance id when the stored id is %s", async (_name, id) => {
      const createdAt = 1_700_000_000_000;
      writeRecord({ v: 1, id, createdAt, checksum: await checksumOf(id, createdAt) });
      vi.setSystemTime(createdAt);

      const resolved = await resolveClientSession(logger);

      expect(resolved.instanceId).not.toBe(id);
      expect(resolved.instanceId).toMatch(UUID_V4_PATTERN);
    });

    test("generates a new instance id when the stored record has an unknown version", async () => {
      vi.setSystemTime(1_700_000_000_000);
      await resolveClientSession(logger);
      const record = readRecord();
      writeRecord({ ...record, v: 2 });

      expect((await resolveClientSession(logger)).instanceId).not.toBe(record.id);
    });

    test.each([
      ["a non-integer", 1_700_000_000_000.5, 1_700_000_000_001.5],
      ["a string", "1700000000000", 1_700_000_000_000],
      ["zero", 0, 0],
      ["negative", -1_000, 0],
    ])(
      "generates a new instance id when the stored creation timestamp is %s",
      async (_name, createdAt, now: number) => {
        const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
        writeRecord({ v: 1, id, createdAt, checksum: await checksumOf(id, createdAt as number) });
        vi.setSystemTime(now);

        expect((await resolveClientSession(logger)).instanceId).not.toBe(id);
      },
    );

    test("resolves an ephemeral instance id without persisting it when localStorage is unavailable", async () => {
      vi.stubGlobal("localStorage", undefined);

      const session = await resolveClientSession(logger);

      expect(session).toEqual({ instanceId: expect.stringMatching(UUID_V4_PATTERN), ephemeral: true });
      expect((await resolveClientSession(logger)).instanceId).not.toBe(session.instanceId);
    });

    test("resolves an ephemeral instance id when localStorage does not implement getItem or setItem", async () => {
      vi.stubGlobal("localStorage", {});

      expect(await resolveClientSession(logger)).toEqual({
        instanceId: expect.stringMatching(UUID_V4_PATTERN),
        ephemeral: true,
      });
    });

    test("resolves an ephemeral instance id when accessing localStorage throws", async () => {
      vi.stubGlobal("localStorage", {
        get getItem() {
          throw new Error("access denied");
        },
      });

      expect(await resolveClientSession(logger)).toEqual({
        instanceId: expect.stringMatching(UUID_V4_PATTERN),
        ephemeral: true,
      });
    });

    test("resolves an ephemeral instance id without writing when reading from localStorage throws", async () => {
      const setItem = vi.fn();
      vi.stubGlobal("localStorage", {
        getItem: () => {
          throw new Error("access denied");
        },
        setItem,
      });

      expect(await resolveClientSession(logger)).toEqual({
        instanceId: expect.stringMatching(UUID_V4_PATTERN),
        ephemeral: true,
      });
      expect(setItem).not.toHaveBeenCalled();
    });

    test("resolves an ephemeral instance id when writing to localStorage throws", async () => {
      vi.stubGlobal("localStorage", {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota exceeded");
        },
      });

      expect(await resolveClientSession(logger)).toEqual({
        instanceId: expect.stringMatching(UUID_V4_PATTERN),
        ephemeral: true,
      });
    });
  });

  describe("with an asynchronous storage adapter", () => {
    const STORED_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

    let read: Deferred<string | null>;
    let write: Deferred<undefined>;
    let storage: { getItem: ReturnType<typeof vi.fn>; setItem: ReturnType<typeof vi.fn> } & InstanceIdStorage;

    beforeEach(() => {
      read = deferred<string | null>();
      write = deferred<undefined>();
      storage = { getItem: vi.fn(() => read.promise), setItem: vi.fn(() => write.promise) };
    });

    test("reuses the stored instance id when the read completes before the deadline", async () => {
      const record = await storedRecordFor(STORED_ID, 1_700_000_000_000);
      vi.setSystemTime(1_700_000_000_000 + 60 * 1_000);

      const session = resolveClientSession(logger, storage);
      await vi.advanceTimersByTimeAsync(500);
      read.resolve(record);

      expect(await session).toEqual({ instanceId: STORED_ID });
      expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    test("generates and stores an instance id when nothing is stored and the write completes before the deadline", async () => {
      vi.setSystemTime(1_700_000_000_000);

      const session = resolveClientSession(logger, storage);
      read.resolve(null);
      await vi.advanceTimersByTimeAsync(500);
      write.resolve(undefined);

      const settled = await session;
      expect(settled).toEqual({ instanceId: expect.stringMatching(UUID_V4_PATTERN) });
      expect(storage.setItem).toHaveBeenCalledTimes(1);
      expect(JSON.parse(storage.setItem.mock.calls[0]?.[1] as string)).toMatchObject({
        v: 1,
        id: settled.instanceId,
        createdAt: 1_700_000_000_000,
      });
    });

    test("falls back to an ephemeral instance id one second after the read started, without writing", async () => {
      const session = resolveClientSession(logger, storage);
      const settlement = settlementOf(session);

      await vi.advanceTimersByTimeAsync(999);
      expect(settlement.settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      expect(settlement.settled).toBe(true);
      expect(await session).toEqual({ instanceId: expect.stringMatching(UUID_V4_PATTERN), ephemeral: true });
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    test("discards a read that completes after the deadline and still writes nothing", async () => {
      const session = resolveClientSession(logger, storage);
      await vi.advanceTimersByTimeAsync(1_000);
      const fallback = await session;

      read.resolve(null);
      await vi.advanceTimersByTimeAsync(0);

      expect(await session).toEqual(fallback);
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    test("keeps the ephemeral instance id when a stored one arrives after the deadline", async () => {
      const record = await storedRecordFor(STORED_ID, 1_700_000_000_000);
      vi.setSystemTime(1_700_000_000_000 + 60 * 1_000);

      const session = resolveClientSession(logger, storage);
      await vi.advanceTimersByTimeAsync(1_000);
      read.resolve(record);
      await vi.advanceTimersByTimeAsync(0);

      expect(await session).toEqual({ instanceId: expect.not.stringMatching(STORED_ID), ephemeral: true });
    });

    test("falls back to an ephemeral instance id when the write has not completed by the deadline", async () => {
      const session = resolveClientSession(logger, storage);
      read.resolve(null);
      await vi.advanceTimersByTimeAsync(1_000);

      expect(await session).toEqual({ instanceId: expect.stringMatching(UUID_V4_PATTERN), ephemeral: true });
    });

    test("resolves an ephemeral instance id without writing when the read rejects", async () => {
      const session = resolveClientSession(logger, storage);
      read.reject(new Error("storage unavailable"));

      expect(await session).toEqual({ instanceId: expect.stringMatching(UUID_V4_PATTERN), ephemeral: true });
      expect(storage.setItem).not.toHaveBeenCalled();
    });

    test("resolves an ephemeral instance id when the write rejects", async () => {
      const session = resolveClientSession(logger, storage);
      read.resolve(null);
      await vi.advanceTimersByTimeAsync(0);
      write.reject(new Error("disk full"));

      expect(await session).toEqual({ instanceId: expect.stringMatching(UUID_V4_PATTERN), ephemeral: true });
    });

    test("does not warn about the deadline once the storage answered before it", async () => {
      const capturingLogger = createCapturingLogger();
      const session = resolveClientSession(capturingLogger, storage);
      read.resolve(null);
      write.resolve(undefined);
      await session;

      await vi.advanceTimersByTimeAsync(1_000);

      expect(capturingLogger.warn).not.toHaveBeenCalled();
    });

    test("resolves an ephemeral instance id when getItem throws synchronously", async () => {
      storage.getItem.mockImplementation(() => {
        throw new Error("not initialized");
      });

      expect(await resolveClientSession(logger, storage)).toEqual({
        instanceId: expect.stringMatching(UUID_V4_PATTERN),
        ephemeral: true,
      });
    });
  });
});
