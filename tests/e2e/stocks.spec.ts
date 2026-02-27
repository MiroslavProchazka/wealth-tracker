import { test, expect } from "@playwright/test";
import { waitForApp, mockStockPricesApi } from "./helpers";

test.describe("Stocks (/stocks)", () => {
  test.beforeEach(async ({ page }) => {
    await mockStockPricesApi(page);
    await page.goto("/stocks");
    await waitForApp(page);
  });

  test("zobrazí nadpis stránky", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /stocks?|akcie/i })).toBeVisible();
  });

  test("zobrazí tlačítko pro přidání holdingu", async ({ page }) => {
    await expect(page.getByRole("button", { name: /add|přidat|\+/i }).first()).toBeVisible();
  });

  test("přidá stock holding", async ({ page }) => {
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();

    const tickerInput = page.locator("input[name='ticker'], input[name='symbol']").first();
    if (await tickerInput.isVisible()) await tickerInput.fill("AAPL");

    const sharesInput = page.locator("input[name='shares'], input[name='amount']").first();
    if (await sharesInput.isVisible()) await sharesInput.fill("10");

    const priceInput = page.locator("input[name='buyPrice']").first();
    if (await priceInput.isVisible()) await priceInput.fill("150");

    const currencySelect = page.locator("select[name='currency']");
    if (await currencySelect.isVisible()) await currencySelect.selectOption("USD");

    const submitBtn = page.getByRole("button", { name: /save|uložit|add|submit/i }).last();
    await submitBtn.click();

    await expect(page.getByText("AAPL")).toBeVisible({ timeout: 5000 });
  });

  test("Stocks odkaz v sidebaru je aktivní", async ({ page }) => {
    const link = page.locator("aside").getByRole("link", { name: /Stocks/i });
    const fontWeight = await link.evaluate((el) =>
      window.getComputedStyle(el).fontWeight
    );
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
  });

  test("stránka se načte bez JS chyb", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
