export { ConfigEvaluator } from "./ConfigEvaluator";
export { ConditionEvaluator } from "./ConditionEvaluator";
export { assignPercentage } from "./percent-hashing";
export type {
  ArrayOperator,
  Condition,
  ConditionalRule,
  Config,
  ConfigDirectorLogger,
  ConfigState,
  DatetimeOperator,
  EnumTypeConstraints,
  EvaluationContext,
  NumberOperator,
  NumericTypeConstraints,
  Operator,
  Percentage,
  PercentageRule,
  Rule,
  SemverOperator,
  Target,
  TargetType,
  TargetingRules,
  TextOperator,
  Variation,
} from "./types";
export {
  ArrayOperatorList,
  DatetimeOperatorList,
  NumberOperatorList,
  SemverOperatorList,
  TargetTypeList,
  TextOperatorList,
} from "./types";
export type { ConfigDirectorContext, ConfigDirectorMetaContext, ConfigType } from "@shared/types";

export const EVALUATOR_VERSION: string = "__VERSION__";
