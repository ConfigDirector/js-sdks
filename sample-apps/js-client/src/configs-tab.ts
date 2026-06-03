import type { ConfigDirectorClient, ConfigValueType } from "@configdirector/client-sdk";

type ConfigDef<T extends ConfigValueType> = { key: string; label: string; defaultValue: T };

const CONFIGS: ConfigDef<ConfigValueType>[] = [
  { key: "temporary-feature-flag", label: "temporary-feature-flag", defaultValue: true },
  { key: "permanent-kill-switch", label: "permanent-kill-switch", defaultValue: false },
  { key: "integer-config", label: "integer-config", defaultValue: "10" },
  { key: "day-of-the-week-config", label: "day-of-the-week-config", defaultValue: "Friday" },
  { key: "json-value-config", label: "json-value-config", defaultValue: {} },
];

function isJsonValue(value: ConfigValueType): value is object {
  return typeof value === "object"; // catches objects, arrays, and null (typeof null === "object")
}

function badgeClass(value: ConfigValueType): string {
  if (typeof value === "boolean") return value ? "badge badge-on config-value" : "badge badge-off config-value";
  return "badge badge-val config-value";
}

function badgeText(value: ConfigValueType): string {
  if (typeof value === "boolean") return value ? "ON" : "OFF";
  return String(value);
}

function createCard(key: string, label: string, value: ConfigValueType): HTMLElement {
  const cardElement = document.createElement("div");
  cardElement.className = isJsonValue(value) ? "config-card config-card-json" : "config-card";
  cardElement.dataset.configKey = key;

  const infoElement = document.createElement("div");
  infoElement.className = "config-info";

  const nameElement = document.createElement("div");
  nameElement.className = "config-name";
  nameElement.textContent = label;

  const keyElement = document.createElement("div");
  keyElement.className = "config-key";
  keyElement.textContent = key;

  infoElement.append(nameElement, keyElement);

  let valueElement: HTMLElement;
  if (isJsonValue(value)) {
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

export function initConfigsTab(client: ConfigDirectorClient): void {
  const list = document.getElementById("configs-list")!;

  for (const config of CONFIGS) {
    const initialValue = client.getValue(config.key, config.defaultValue);
    const card = createCard(config.key, config.label, initialValue);
    list.appendChild(card);

    client.watch(config.key, config.defaultValue, (value) => {
      const valueEl = card.querySelector<HTMLElement>(".config-value")!;
      if (isJsonValue(value)) {
        valueEl.textContent = JSON.stringify(value, null, 2);
      } else {
        valueEl.className = badgeClass(value);
        valueEl.textContent = badgeText(value);
      }
    });
  }
}
