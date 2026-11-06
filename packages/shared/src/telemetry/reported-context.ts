import type { ConfigDirectorContext } from "../types";

const USER_CONTEXT_KIND = "user";

type ReportedContext = { contextKind?: string; contextIdentifier?: string };

export const reportedContextOf = (context: ConfigDirectorContext | undefined): ReportedContext => {
  const contextIdentifier = context?.anonymous ? undefined : context?.id;
  if (contextIdentifier === undefined) {
    return {};
  }
  return { contextKind: context?.kind ?? USER_CONTEXT_KIND, contextIdentifier };
};
