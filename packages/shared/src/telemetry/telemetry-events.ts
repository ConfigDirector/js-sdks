import type { ConfigType, ConfigValueType, EvaluationReason } from "../types";

export type EvaluatedConfigEvent<T extends ConfigValueType> = {
  contextId?: string;
  contextKind?: string;
  key: string;
  type?: ConfigType;
  defaultValue: T;
  requestedType: string;
  evaluatedValue: T;
  evaluatedValueId?: string | null | undefined;
  usedDefault: boolean;
  evaluationReason: EvaluationReason;
  ruleId?: string | undefined;
  shareId?: string | undefined;
  variationId?: string | undefined;
};

export type InvalidContextEvent = {
  reason: "invalid-context-kind";
  kindSample?: string;
};
