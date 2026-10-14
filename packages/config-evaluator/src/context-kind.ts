import type { EvaluationContext } from "./types";

export const USER_CONTEXT_KIND = "user";

export const effectiveContextKind = (context: EvaluationContext | undefined): string =>
  context?.context?.kind ?? USER_CONTEXT_KIND;
