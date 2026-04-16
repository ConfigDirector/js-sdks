import type { UrlFactory, UrlLike } from "@shared/url";

class MinimalUrl implements UrlLike {
  private readonly href: string;

  constructor(input: string, base?: UrlLike) {
    if (base) {
      const b = base.toString();
      this.href = (b.endsWith("/") ? b : b + "/") + input;
    } else {
      this.href = input;
    }
  }

  toString() {
    return this.href;
  }
}

export const urlFactory: UrlFactory = (input, base) =>
  new MinimalUrl(input, base);
