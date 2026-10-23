import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { forgetCachedValues } from "./helpers";

expect.extend(matchers);

beforeEach(forgetCachedValues);

afterEach(() => {
  cleanup();
  forgetCachedValues();
});
