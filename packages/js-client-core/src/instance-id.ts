import { generateInstanceId } from "@shared/instance-id";
import type { ConfigDirectorLogger } from "./types";

const STORAGE_KEY = "configdirector-sdk:instance-id";
const RECORD_VERSION = 1;
const MAX_AGE_MS = 6 * 60 * 60 * 1_000;
const CHECKSUM_SALT = "configdirector.instanceId.v1";
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

type StoredInstanceId = {
  v: number;
  id: string;
  createdAt: number;
  checksum: string;
};

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

const getLocalStorage = (): Storage | undefined => {
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

const readStoredInstanceId = (storage: Storage, logger?: ConfigDirectorLogger): string | undefined => {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (error) {
    logger?.debug("[ConfigDirectorClient] Could not read the stored instance id, generating a new one", error);
    return undefined;
  }

  if (!raw) {
    return undefined;
  }

  let record: unknown;
  try {
    record = JSON.parse(raw);
  } catch {
    logger?.debug("[ConfigDirectorClient] The stored instance id is not valid JSON, generating a new one");
    return undefined;
  }

  if (!isUsableRecord(record)) {
    logger?.debug("[ConfigDirectorClient] The stored instance id failed validation, generating a new one");
    return undefined;
  }

  const age = Date.now() - record.createdAt;
  if (age < 0 || age >= MAX_AGE_MS) {
    logger?.debug("[ConfigDirectorClient] The stored instance id has expired, generating a new one");
    return undefined;
  }

  return record.id;
};

const storeInstanceId = (storage: Storage, id: string, logger?: ConfigDirectorLogger) => {
  const createdAt = Date.now();
  const record: StoredInstanceId = { v: RECORD_VERSION, id, createdAt, checksum: checksumFor(id, createdAt) };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    logger?.debug("[ConfigDirectorClient] Could not persist the instance id", error);
  }
};

export const resolveInstanceId = (logger?: ConfigDirectorLogger): string => {
  const storage = getLocalStorage();
  if (!storage) {
    return generateInstanceId();
  }

  const storedInstanceId = readStoredInstanceId(storage, logger);
  if (storedInstanceId) {
    return storedInstanceId;
  }

  const instanceId = generateInstanceId();
  storeInstanceId(storage, instanceId, logger);
  return instanceId;
};
