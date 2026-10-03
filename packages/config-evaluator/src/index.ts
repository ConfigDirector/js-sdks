export { ConfigEvaluator } from "./ConfigEvaluator";
export { ConditionEvaluator } from "./ConditionEvaluator";
export { assignPercentage } from "./percent-hashing";
export type {
  ArrayOperator,
  AttributeCondition,
  BucketExplanation,
  Condition,
  ConditionGroup,
  ConditionCheck,
  ConditionExplanation,
  ConditionalRule,
  Config,
  ConfigDirectorLogger,
  ConfigState,
  DatetimeOperator,
  EnumTypeConstraints,
  EvaluationContext,
  EvaluationExplanation,
  NumberOperator,
  NumericTypeConstraints,
  Operator,
  Percentage,
  PercentageRule,
  ResolvedType,
  Rule,
  RuleExplanation,
  RuleOutcome,
  Segment,
  SegmentCondition,
  SegmentOperator,
  Segments,
  SemverOperator,
  ServedBy,
  Share,
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
  SegmentOperatorList,
  SemverOperatorList,
  TargetTypeList,
  TextOperatorList,
} from "./types";
export type { ConfigDirectorContext, ConfigDirectorMetaContext, ConfigType } from "@shared/types";

export const EVALUATOR_VERSION: string = "__VERSION__";
