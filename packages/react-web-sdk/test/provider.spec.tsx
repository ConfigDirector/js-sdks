import { describe, it } from "vitest";
import { render } from "@testing-library/react";
import { ConfigDirectorProvider } from "../src/provider";

describe("ConfigDirectorProvider", () => {
  it("builds", () => {
    render(<ConfigDirectorProvider sdkKey="dummy-key"></ConfigDirectorProvider>);
  });
});
