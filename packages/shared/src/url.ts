import { ConfigDirectorValidationError } from "./errors";

export interface UrlLike {
  toString(): string;
}

export type UrlFactory = (input: string, base?: UrlLike) => UrlLike;

export const defaultUrlFactory: UrlFactory = (input, base) => new URL(input, base?.toString());

export const parseUrl = (url: string | undefined): URL | undefined => {
  if (!url) {
    return;
  }

  try {
    return new URL(url);
  } catch (error) {
    throw new ConfigDirectorValidationError(`Invalid URL '${url}'. Parsing failed: ${error}`);
  }
};
