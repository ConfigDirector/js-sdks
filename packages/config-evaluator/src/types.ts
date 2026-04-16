import type { ConfigType, ConfigDirectorContext, ConfigDirectorMetaContext } from "@shared/types";

export const TextOperatorList = [
  "equals",
  "does NOT equal",
  "is one of",
  "is NOT one of",
  "starts with any of",
  "does NOT start with any of",
  "ends with any of",
  "does NOT end with any of",
  "matches regex",
  "does NOT match regex",
] as const;
export const NumberOperatorList = ["=", "!=", ">", ">=", "<", "<="] as const;
export const SemverOperatorList = ["is one of", "is NOT one of", ">", ">=", "<", "<="] as const;
export const DatetimeOperatorList = ["is before", "is after"] as const;
export const ArrayOperatorList = ["contains any of", "does NOT contain any of"] as const;

export type TextOperator = (typeof TextOperatorList)[number];
export type NumberOperator = (typeof NumberOperatorList)[number];
export type SemverOperator = (typeof SemverOperatorList)[number];
export type DatetimeOperator = (typeof DatetimeOperatorList)[number];
export type ArrayOperator = (typeof ArrayOperatorList)[number];

export type Operator = TextOperator | NumberOperator | SemverOperator | DatetimeOperator | ArrayOperator;

export type Target = "value" | "percentage";

export const TargetTypeList = ["text", "number", "semver", "datetime", "array"] as const;
export type TargetType = (typeof TargetTypeList)[number];

export type Condition = {
  id: string;
  attribute: string;
  trait?: string | undefined;
  operator: Operator;
  targetType: TargetType;
  targetValues: string[];
};
export type ConditionalRule = {
  id: string;
  type: "conditional";
  order: number;
  conditions: Condition[];
  target: Target;
  value: string | number | boolean | undefined;
  percentages: Percentage[];
};
export type Percentage = {
  id: string;
  percentage: number;
  value: string | number | boolean | undefined;
};
export type PercentageRule = {
  id: string;
  type: "percentage";
  target: "percentage";
  order: number;
  percentages: Percentage[];
};

export type Rule = ConditionalRule | PercentageRule;

export type TargetingRules = {
  defaultValue: string;
  rules: Rule[];
};

export type Variation = {
  name: string | null | undefined;
  value: string | number | boolean;
};

export type NumericTypeConstraints = {
  min?:
    | {
        relation: ">" | ">=";
        value: number;
      }
    | undefined;
  max?:
    | {
        relation: "<" | "<=";
        value: number;
      }
    | undefined;
};

export type EnumTypeConstraints = {
  valueType: "string" | "number";
  values: string[];
};

export type Config = {
  id: string;
  key: string;
  type: ConfigType;
  typeConstraints?: NumericTypeConstraints | EnumTypeConstraints | null | undefined;
  variations: Variation[];
  target: TargetingRules;
};

export type EvaluationContext = {
  context?: ConfigDirectorContext;
  metadata?: ConfigDirectorMetaContext;
};
