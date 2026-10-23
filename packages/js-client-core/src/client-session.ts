import { generateInstanceId } from "@shared/instance-id";
import type { ClientSession, ConfigDirectorLogger, InstanceIdStorage } from "./types";

const STORAGE_KEY = "configdirector-sdk:instance-id";
const RECORD_VERSION = 1;
const STORAGE_DEADLINE_MS = 1_000;
const CHECKSUM_SALT = "configdirector.instanceId.v1";
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type StoredInstanceId = {
  v: number;
  id: string;
  createdAt: number;
  checksum: string;
};

type StorageRead =
  | { outcome: "stored"; instanceId: string }
  | { outcome: "nothing usable" }
  | { outcome: "failed" };

type Deadline = { passed: boolean };

const fnv1a = (input: string, offsetBasis: number): number => {
  let hash = offsetBasis;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const checksumFor = (id: string, createdAt: number): string => {
  const payload = `${CHECKSUM_SALT}|${id}|${createdAt}`;
  const low = fnv1a(payload, 0x811c9dc5);
  const high = fnv1a(`${low}|${payload}`, 0x01000193);
  return high.toString(16).padStart(8, "0") + low.toString(16).padStart(8, "0");
};

const localStorageIfAvailable = (): InstanceIdStorage | undefined => {
  try {
    return (globalThis as { localStorage?: Storage }).localStorage ?? undefined;
  } catch {
    return undefined;
  }
};

const isUsableRecord = (record: unknown): record is StoredInstanceId => {
  if (!record || typeof record !== "object") {
    return false;
  }

  const { v, id, createdAt, checksum } = record as Partial<StoredInstanceId>;
  if (v !== RECORD_VERSION || typeof id !== "string" || typeof checksum !== "string") {
    return false;
  }

  if (typeof createdAt !== "number" || !Number.isInteger(createdAt) || createdAt <= 0) {
    return false;
  }

  if (!UUID_V4_PATTERN.test(id)) {
    return false;
  }

  return checksum === checksumFor(id, createdAt);
};

const readStoredInstanceId = async (
  storage: InstanceIdStorage,
  logger: ConfigDirectorLogger,
): Promise<StorageRead> => {
  let raw: unknown;
  try {
    raw = await storage.getItem(STORAGE_KEY);
  } catch (error) {
    logger.debug(
      "[ConfigDirectorClient] Could not read the stored instance id, using an ephemeral one",
      error,
    );
    return { outcome: "failed" };
  }

  if (typeof raw !== "string" || raw === "") {
    return { outcome: "nothing usable" };
  }

  let record: unknown;
  try {
    record = JSON.parse(raw);
  } catch {
    logger.debug("[ConfigDirectorClient] The stored instance id is not valid JSON, generating a new one");
    return { outcome: "nothing usable" };
  }

  if (!isUsableRecord(record)) {
    logger.debug("[ConfigDirectorClient] The stored instance id failed validation, generating a new one");
    return { outcome: "nothing usable" };
  }

  return { outcome: "stored", instanceId: record.id };
};

const persistInstanceId = async (
  storage: InstanceIdStorage,
  id: string,
  logger: ConfigDirectorLogger,
): Promise<boolean> => {
  const createdAt = Date.now();
  const record: StoredInstanceId = { v: RECORD_VERSION, id, createdAt, checksum: checksumFor(id, createdAt) };
  try {
    await storage.setItem(STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch (error) {
    logger.debug(
      "[ConfigDirectorClient] Could not persist the instance id, using it as an ephemeral one",
      error,
    );
    return false;
  }
};

const settleFromStorage = async (
  storage: InstanceIdStorage,
  provisionalId: string,
  deadline: Deadline,
  logger: ConfigDirectorLogger,
): Promise<ClientSession> => {
  const read = await readStoredInstanceId(storage, logger);
  switch (read.outcome) {
    case "stored":
      return { instanceId: read.instanceId };
    case "failed":
      return { instanceId: provisionalId, ephemeral: true };
    case "nothing usable":
      break;
  }

  if (deadline.passed) {
    return { instanceId: provisionalId, ephemeral: true };
  }

  const persisted = await persistInstanceId(storage, provisionalId, logger);
  return persisted ? { instanceId: provisionalId } : { instanceId: provisionalId, ephemeral: true };
};

export const resolveClientSession = (
  logger: ConfigDirectorLogger,
  storage: InstanceIdStorage | undefined = localStorageIfAvailable(),
): Promise<ClientSession> => {
  const provisionalId = generateInstanceId();
  if (!storage) {
    logger.debug(
      "[ConfigDirectorClient] No instance id storage is available, using an ephemeral instance id",
    );
    return Promise.resolve({ instanceId: provisionalId, ephemeral: true });
  }

  const deadline: Deadline = { passed: false };
  let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
  const fallbackAtDeadline = new Promise<ClientSession>((resolve) => {
    deadlineTimer = setTimeout(() => {
      deadline.passed = true;
      logger.warn(
        `[ConfigDirectorClient] The instance id storage did not respond within ${STORAGE_DEADLINE_MS}ms, using an ephemeral instance id`,
      );
      resolve({ instanceId: provisionalId, ephemeral: true });
    }, STORAGE_DEADLINE_MS);
  });

  return Promise.race([
    settleFromStorage(storage, provisionalId, deadline, logger),
    fallbackAtDeadline,
  ]).finally(() => clearTimeout(deadlineTimer));
};
