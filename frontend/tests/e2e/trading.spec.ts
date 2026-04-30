import { test, expect, DISPLAYED_ADDRESS } from "../fixtures/wallet.fixture";

// ---------------------------------------------------------------------------
// Disconnected state
// ---------------------------------------------------------------------------

test.describe("disconnected state", () => {
  test("order form shows connect-wallet prompt", async ({ mockPage: page }) => {
    await page.goto("/");
    await expect(page.getByText("Connect wallet to trade")).toBeVisible();
  });

  test("positions table shows connect-wallet prompt", async ({ mockPage: page }) => {
    await page.goto("/");
    await expect(page.getByText("Connect wallet to view positions.")).toBeVisible();
  });

  test("market bar visible without wallet", async ({ mockPage: page }) => {
    await page.goto("/");
    await expect(page.getByText("BTC-USD")).toBeVisible();
    await expect(page.getByText("Mark")).toBeVisible();
  });

  test("header shows Connect Wallet button", async ({ mockPage: page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /connect wallet/i }).first()
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Auto-connect (wallet connected on load — no modal interaction)
// ---------------------------------------------------------------------------

test.describe("auto-connect", () => {
  test("wallet address appears in header", async ({ connectedPage: page }) => {
    await expect(page.getByText(DISPLAYED_ADDRESS)).toBeVisible();
  });

  test("order form is visible when connected", async ({ connectedPage: page }) => {
    await expect(page.getByText("Open Position")).toBeVisible();
    await expect(page.getByRole("button", { name: "LONG", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "SHORT", exact: true })).toBeVisible();
  });

  test("dashboard shows positions and trade history tabs when connected", async ({ connectedPage: page }) => {
    await expect(page.getByRole("button", { name: /Positions/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Trade History/ })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Order form (wallet connected via fixture)
// ---------------------------------------------------------------------------

test.describe("order form", () => {
  test("long/short toggle works", async ({ connectedPage: page }) => {
    const longBtn  = page.getByRole("button", { name: "LONG",  exact: true });
    const shortBtn = page.getByRole("button", { name: "SHORT", exact: true });

    // Switch to Short
    await shortBtn.click();
    await expect(page.getByRole("button", { name: /open short/i })).toBeVisible();

    // Switch back to Long
    await longBtn.click();
    await expect(page.getByRole("button", { name: /open long/i })).toBeVisible();
  });

  test("all leverage buttons are rendered", async ({ connectedPage: page }) => {
    for (const label of ["1×", "2×", "3×", "5×", "10×"]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("collateral input shows order preview", async ({ connectedPage: page }) => {
    // Mock price API so the preview section renders (requires mark > 0)
    await page.route("/api/price/current", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ price: 50000, timestamp: Date.now() / 1000 }),
      })
    );
    await page.reload();
    await page.getByText(DISPLAYED_ADDRESS).waitFor({ state: "visible", timeout: 15_000 });

    await page.getByPlaceholder("100").fill("500");

    await expect(page.getByText("Entry Price")).toBeVisible();
    await expect(page.getByText("Notional")).toBeVisible();
    await expect(page.getByText("Open Fee")).toBeVisible();
    await expect(page.getByText("Liq Price")).toBeVisible();
  });

  test("submit disabled when collateral empty", async ({ connectedPage: page }) => {
    await page.getByPlaceholder("100").clear();
    await expect(
      page.getByRole("button", { name: /open long|open short/i })
    ).toBeDisabled();
  });

  test("submit enabled when collateral filled", async ({ connectedPage: page }) => {
    await page.getByPlaceholder("100").fill("100");
    await expect(
      page.getByRole("button", { name: /open long|open short/i })
    ).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe("navigation", () => {
  test("nav links visible in header", async ({ mockPage: page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Trade" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Liquidate" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leaderboard" })).toBeVisible();
  });

  test("leaderboard page loads", async ({ mockPage: page }) => {
    await page.goto("/leaderboard");
    await expect(page).toHaveURL("/leaderboard");
  });
});
