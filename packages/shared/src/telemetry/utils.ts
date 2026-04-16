import type { ConfigType, ConfigValueType } from "../types";
import { type DroppedEvents } from "./types";

const CONFIG_VALUE_MAX_LENGTH = 500;

export const sanitizeValue = <TV extends ConfigValueType>(value: TV, type?: ConfigType): string => {
  if (type === "json") {
    try {
      const json = JSON.stringify(value);
      return djb2Hash(json);
    } catch {
      return value.toString().slice(0, CONFIG_VALUE_MAX_LENGTH);
    }
  }

  return value.toString().slice(0, CONFIG_VALUE_MAX_LENGTH);
};

export const djb2Hash = (data: string): string => {
  const hash = djb2(new TextEncoder().encode(data));
  return hash.toString(16).padStart(8, "0");
};

const djb2 = (bytes: Uint8Array): number => {
  let hash = 5381;
  for (let i = 0; i < bytes.length; i++) {
    hash = (hash << 5) + hash + (bytes[i] ?? 0);
    hash = hash >>> 0;
  }
  return hash;
};

export const isEventListEmpty = <T extends Record<string | symbol, any[]>>(eventList: T): boolean => {
  const keys = Object.keys(eventList);
  if (keys.length == 0) {
    return true;
  }

  for (const key of keys) {
    if ((eventList[key]?.length ?? 0) > 0) {
      return false;
    }
  }

  return true;
};

export const isDroppedEventsEmpty = (droppedEvents?: DroppedEvents): boolean => {
  if (!droppedEvents) {
    return true;
  }
  const keys = Object.keys(droppedEvents);
  if (keys.length == 0) {
    return true;
  }

  for (const key of keys) {
    if ((droppedEvents[key] ?? 0) > 0) {
      return false;
    }
  }

  return true;
};
