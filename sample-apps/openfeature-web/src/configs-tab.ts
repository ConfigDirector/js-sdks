import type { Client, JsonValue } from "@openfeature/web-sdk";
import { ProviderEvents } from "@openfeature/web-sdk";

type ConfigDef =
  | { key: string; label: string; kind: "boolean"; defaultValue: boolean }
  | { key: string; label: string; kind: "string"; defaultValue: string }
  | { key: string; label: string; kind: "number"; defaultValue: number }
  | { key: string; label: string; kind: "object"; defaultValue: JsonValue };

const CONFIGS: ConfigDef[] = [
  { key: "temporary-feature-flag", label: "temporary-feature-flag", kind: "boolean", defaultValue: true },
  { key: "permanent-kill-switch", label: "permanent-kill-switch", kind: "boolean", defaultValue: false },
  { key: "integer-config", label: "integer-config", kind: "number", defaultValue: 10 },
  { key: "day-of-the-week-config", label: "day-of-the-week-config", kind: "string", defaultValue: "Friday" },
  { key: "json-value-config", label: "json-value-config", kind: "object", defaultValue: {} },
];

type ConfigValue = boolean | string | number | JsonValue;

function resolveValue(client: Client, config: ConfigDef): ConfigValue {
  switch (config.kind) {
    case "boolean":
      return client.getBooleanValue(config.key, config.defaultValue);
    case "string":
      return client.getStringValue(config.key, config.defaultValue);
    case "number":
      return client.getNumberValue(config.key, config.defaultValue);
    case "object":
      return client.getObjectValue(config.key, config.defaultValue);
  }
}

function isJsonValue(config: ConfigDef, _value: ConfigValue): _value is JsonValue {
  return config.kind === "object";
}

function badgeClass(value: ConfigValue): string {
  if (typeof value === "boolean") return value ? "badge badge-on config-value" : "badge badge-off config-value";
  return "badge badge-val config-value";
}

function badgeText(value: ConfigValue): string {
  if (typeof value === "boolean") return value ? "ON" : "OFF";
  return String(value);
}

function createCard(config: ConfigDef, value: ConfigValue): HTMLElement {
  const cardElement = document.createElement("div");
  cardElement.className = isJsonValue(config, value) ? "config-card config-card-json" : "config-card";
  cardElement.dataset.configKey = config.key;

  const infoElement = document.createElement("div");
  infoElement.className = "config-info";

  const nameElement = document.createElement("div");
  nameElement.className = "config-name";
  nameElement.textContent = config.label;

  const keyElement = document.createElement("div");
  keyElement.className = "config-key";
  keyElement.textContent = config.key;

  infoElement.append(nameElement, keyElement);

  let valueElement: HTMLElement;
  if (isJsonValue(config, value)) {
    valueElement = document.createElement("pre");
    valueElement.className = "config-json config-value";
    valueElement.textContent = JSON.stringify(value, null, 2);
  } else {
    valueElement = document.createElement("div");
    valueElement.className = badgeClass(value);
    valueElement.textContent = badgeText(value);
  }

  cardElement.append(infoElement, valueElement);
  return cardElement;
}

export function initConfigsTab(client: Client): void {
  const list = document.getElementById("configs-list")!;
  const cards = new Map<string, HTMLElement>();

  for (const config of CONFIGS) {
    const initialValue = resolveValue(client, config);
    const card = createCard(config, initialValue);
    list.appendChild(card);
    cards.set(config.key, card);
  }

  client.addHandler(ProviderEvents.ConfigurationChanged, (details) => {
    const changedKeys = new Set(details?.flagsChanged ?? []);
    for (const config of CONFIGS) {
      if (!changedKeys.has(config.key)) continue;

      const card = cards.get(config.key)!;
      const value = resolveValue(client, config);
      const valueEl = card.querySelector<HTMLElement>(".config-value")!;
      if (isJsonValue(config, value)) {
        valueEl.textContent = JSON.stringify(value, null, 2);
      } else {
        valueEl.className = badgeClass(value);
        valueEl.textContent = badgeText(value);
      }
    }
  });
}
