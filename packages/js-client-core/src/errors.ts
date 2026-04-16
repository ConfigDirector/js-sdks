export { ConfigDirectorConnectionError, ConfigDirectorValidationError } from "../../shared/src/errors";

export const isFetchErrorFatal = (fetchError: any): boolean => {
  if (fetchError?.name === "NotAllowedError") {
    return true;
  } else if (fetchError instanceof TypeError) {
    return true;
  }

  return false;
};
