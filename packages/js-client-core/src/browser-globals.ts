type BrowserGlobals = {
  navigator?: { userAgent?: string };
  location?: { host?: string };
};

const read = (readValue: (globals: BrowserGlobals) => string | undefined): string | undefined => {
  try {
    return readValue(globalThis as BrowserGlobals);
  } catch {
    return undefined;
  }
};

export const readUserAgent = (): string | undefined => read((globals) => globals.navigator?.userAgent);

export const readHost = (): string | undefined => read((globals) => globals.location?.host);
