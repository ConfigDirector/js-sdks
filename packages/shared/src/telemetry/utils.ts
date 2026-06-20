import type { ConfigType, ConfigValueType } from "../types";
import type { ValueIdGenerator, DroppedEvents } from "./types";

const CONFIG_VALUE_MAX_LENGTH = 500;

export type TelemetryValue = {
  value?: string;
  valueId?: string;
  type?: ConfigType;
};

export type TelemetryEvaluationValue<TV extends ConfigValueType> = {
  value: TV;
  valueId?: string | null | undefined;
  type?: ConfigType;
};

export const compactTelemetryValue = async (
  tv: TelemetryValue,
  valueIdGenerator: ValueIdGenerator,
): Promise<TelemetryValue> => {
  if (tv.valueId) {
    return { valueId: tv.valueId };
  }
  if (tv.value) {
    if (tv.value.length <= CONFIG_VALUE_MAX_LENGTH && tv.type != "json") {
      return { value: tv.value };
    }

    return { valueId: await valueIdGenerator(tv.value) };
  }

  return tv;
};

export const mapToTelemetryValue = <TV extends ConfigValueType>(
  ev: TelemetryEvaluationValue<TV>,
): TelemetryValue => {
  if (ev.type === "json" || (ev.type == null && typeof ev.value === "object")) {
    if (ev.valueId) {
      return { valueId: ev.valueId, type: "json" };
    }
    try {
      const json = JSON.stringify(ev.value);
      return { value: json, type: "json" };
    } catch {
      return { value: ev.value.toString(), type: "json" };
    }
  }

  const stringValue = ev.value?.toString();
  if (stringValue && stringValue.length <= CONFIG_VALUE_MAX_LENGTH) {
    return { value: stringValue };
  }

  return ev.valueId ? { valueId: ev.valueId } : { value: stringValue };
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
