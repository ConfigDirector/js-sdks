const ARRAY_INDEX_PATTERN = /^(?:0|[1-9][0-9]*)$/;

const INVALID_ESCAPE_PATTERN = /~(?![01])/;

const isSerializedMember = Object.prototype.propertyIsEnumerable;

const decodeReferenceToken = (token: string): string | undefined => {
  if (INVALID_ESCAPE_PATTERN.test(token)) {
    return undefined;
  }
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
};

const step = (current: unknown, token: string): unknown => {
  if (Array.isArray(current)) {
    return ARRAY_INDEX_PATTERN.test(token) && isSerializedMember.call(current, token)
      ? current[Number(token)]
      : undefined;
  }
  if (typeof current === "object" && current !== null) {
    return isSerializedMember.call(current, token) ? (current as Record<string, unknown>)[token] : undefined;
  }
  return undefined;
};

export const resolveJsonPointer = (pointer: string, document: unknown): unknown => {
  if (pointer === "") {
    return document;
  }
  if (!pointer.startsWith("/")) {
    return undefined;
  }
  let current = document;
  for (const encodedToken of pointer.slice(1).split("/")) {
    const token = decodeReferenceToken(encodedToken);
    if (token === undefined) {
      return undefined;
    }
    current = step(current, token);
    if (current === undefined) {
      return undefined;
    }
  }
  return current;
};
