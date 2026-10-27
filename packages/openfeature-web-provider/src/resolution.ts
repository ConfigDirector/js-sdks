import type { ResolutionDetails } from "@openfeature/web-sdk";
import { ErrorCode, StandardResolutionReasons } from "@openfeature/web-sdk";
import type { ConfigEvaluation, ConfigValueType, EvaluationReason } from "@js-client-core/index";

type ResolutionDetailsFor = <T extends ConfigValueType>(
  evaluation: ConfigEvaluation<T>,
) => ResolutionDetails<T>;

const failedResolution = <T extends ConfigValueType>(
  value: T,
  errorCode: ErrorCode,
  errorMessage: string,
): ResolutionDetails<T> => ({
  value,
  reason: StandardResolutionReasons.ERROR,
  errorCode,
  errorMessage,
});

const typeMismatch: ResolutionDetailsFor = (evaluation) =>
  failedResolution(
    evaluation.value,
    ErrorCode.TYPE_MISMATCH,
    `The value of '${evaluation.key}' cannot be read as the requested type (${evaluation.reason}).`,
  );

const resolutionDetailsByReason: { [R in EvaluationReason]: ResolutionDetailsFor } = {
  "found-match": (evaluation) => ({
    value: evaluation.value,
    variant: evaluation.valueId,
    reason: StandardResolutionReasons.TARGETING_MATCH,
  }),
  cached: (evaluation) => ({
    value: evaluation.value,
    variant: evaluation.valueId,
    reason: StandardResolutionReasons.CACHED,
  }),
  "value-missing": (evaluation) => ({ value: evaluation.value, reason: StandardResolutionReasons.DEFAULT }),
  "config-state-missing": (evaluation) =>
    failedResolution(
      evaluation.value,
      ErrorCode.FLAG_NOT_FOUND,
      `No config with the key '${evaluation.key}' was found.`,
    ),
  "client-not-ready": (evaluation) =>
    failedResolution(
      evaluation.value,
      ErrorCode.PROVIDER_NOT_READY,
      "ConfigDirector has not delivered config state yet.",
    ),
  "type-mismatch": typeMismatch,
  "invalid-number": typeMismatch,
  "invalid-json": typeMismatch,
  "invalid-boolean": typeMismatch,
};

export const resolutionOf = <T extends ConfigValueType>(
  evaluation: ConfigEvaluation<T>,
): ResolutionDetails<T> => resolutionDetailsByReason[evaluation.reason](evaluation);
