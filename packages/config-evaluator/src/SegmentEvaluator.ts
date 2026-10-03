import type { ConditionEvaluator } from "./ConditionEvaluator";
import type { EvaluationContext, Segment, SegmentCheck, SegmentCondition, Segments } from "./types";

export class SegmentEvaluator {
  constructor(private readonly conditionEvaluator: ConditionEvaluator) {}

  public explain(
    condition: SegmentCondition,
    segments: Segments | undefined,
    context?: EvaluationContext,
  ): SegmentCheck {
    const segment = segments?.[condition.segmentId];
    if (segment === undefined || !holdsAttributeConditionsOnly(segment)) {
      return { matched: false, segmentFound: false, matchedGroupIndex: undefined };
    }
    const matchedGroupIndex = this.matchingGroupIndex(segment, context);
    const member = matchedGroupIndex !== undefined;
    return { matched: this.operatorHolds(condition, member), segmentFound: true, matchedGroupIndex };
  }

  private operatorHolds(condition: SegmentCondition, member: boolean): boolean {
    switch (condition.operator.toLowerCase()) {
      case "in":
        return member;
      case "not in":
        return !member;
      default:
        return false;
    }
  }

  private matchingGroupIndex(segment: Segment, context?: EvaluationContext): number | undefined {
    const index = (segment.groups ?? []).findIndex((group) =>
      (group ?? []).every((condition) => this.conditionEvaluator.evaluate(condition, context)),
    );
    return index === -1 ? undefined : index;
  }
}

const holdsAttributeConditionsOnly = (segment: Segment): boolean =>
  (segment.groups ?? []).every((group) =>
    (group ?? []).every((condition) => condition.kind === undefined || condition.kind === "attribute"),
  );
