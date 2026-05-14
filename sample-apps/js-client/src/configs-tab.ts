import type { ConfigDirectorClient, ConfigValueType } from "@configdirector/client-sdk";

type ConfigDef<T extends ConfigValueType> = { key: string; label: string; defaultValue: T };

const CONFIGS: [ConfigDef<boolean>, ConfigDef<boolean>, ConfigDef<string>, ConfigDef<string>] = [
  { key: "temporary-feature-flag", label: "temporary-feature-flag", defaultValue: true },
  { key: "permanent-kill-switch", label: "permanent-kill-switch", defaultValue: false },
  { key: "integer-config", label: "integer-config", defaultValue: "10" },
  { key: "day-of-the-week-config", label: "day-of-the-week-config", defaultValue: "Friday" },
];

function badgeClass(value: ConfigValueType): string {
  if (typeof value === "boolean") return value ? "badge badge-on" : "badge badge-off";
  return "badge badge-val";
}

function badgeText(value: ConfigValueType): string {
  if (typeof value === "boolean") return value ? "ON" : "OFF";
  return String(value);
}

function createCard(key: string, label: string, value: ConfigValueType): HTMLElement {
  const cardElement = document.createElement("div");
  cardElement.className = "config-card";
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

  const badgeElement = document.createElement("div");
  badgeElement.className = badgeClass(value);
  badgeElement.textContent = badgeText(value);

  cardElement.append(infoElement, badgeElement);
  return cardElement;
}

export function initConfigsTab(client: ConfigDirectorClient): void {
  const list = document.getElementById("configs-list")!;

  for (const config of CONFIGS) {
    const initialValue = client.getValue(config.key, config.defaultValue);
    const card = createCard(config.key, config.label, initialValue);
    list.appendChild(card);

    client.watch(config.key, config.defaultValue, (value) => {
      const badge = card.querySelector<HTMLElement>(".badge")!;
      badge.className = badgeClass(value);
      badge.textContent = badgeText(value);
    });
  }
}
