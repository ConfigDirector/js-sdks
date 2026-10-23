import { expect } from "vitest";
import type { Page } from "playwright";

export const textOf = (page: Page, testId: string) =>
  expect.poll(async () => (await page.locator(`[data-testid="${testId}"]`).textContent())?.trim(), {
    timeout: 10_000,
  });
