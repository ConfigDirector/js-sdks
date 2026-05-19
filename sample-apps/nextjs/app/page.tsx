"use client";

import { useConfigValue } from "@configdirector/nextjs-sdk/client";
import type { ConfigValueType } from "@configdirector/nextjs-sdk/server";

function badgeClass(value: ConfigValueType): string {
  if (typeof value === "boolean") return value ? "badge badge-on" : "badge badge-off";
  return "badge badge-val";
}

function badgeText(value: ConfigValueType): string {
  if (typeof value === "boolean") return value ? "ON" : "OFF";
  return String(value);
}

function ConfigCard({ configKey, defaultValue }: { configKey: string; defaultValue: ConfigValueType }) {
  const { value } = useConfigValue(configKey, defaultValue);
  return (
    <div className="config-card">
      <div className="config-info">
        <div className="config-name">{configKey}</div>
        <div className="config-key">{configKey}</div>
      </div>
      <div className={badgeClass(value)}>{badgeText(value)}</div>
    </div>
  );
}

export default function FlagsPage() {
  return (
    <div className="page">
      <h2 className="section-title">Feature Flags</h2>
      <ConfigCard configKey="temporary-feature-flag" defaultValue={true} />
      <ConfigCard configKey="permanent-kill-switch" defaultValue={false} />
      <ConfigCard configKey="integer-config" defaultValue="10" />
      <ConfigCard configKey="day-of-the-week-config" defaultValue="Friday" />
    </div>
  );
}
