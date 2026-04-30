import { test as base, type Page } from "@playwright/test";

export const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
export const DISPLAYED_ADDRESS = "0xf3…2266";

type Fixtures = {
  /** Plain page — wallet NOT connected (for disconnected-state tests). */
  mockPage: Page;
  /** Page with wallet auto-connected via the E2E AutoConnect component. */
  connectedPage: Page;
};

export const test = base.extend<Fixtures>({
  mockPage: async ({ page }, use) => {
    await use(page);
  },

  connectedPage: async ({ page }, use) => {
    // Set the flag BEFORE navigation so AutoConnect picks it up on first mount
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__E2E_AUTO_CONNECT__ = true;
    });

    await page.goto("/");

    // Wait until RainbowKit shows the connected address in the header
    await page
      .getByText(DISPLAYED_ADDRESS)
      .waitFor({ state: "visible", timeout: 15_000 });

    await use(page);
  },
});

export { expect } from "@playwright/test";
