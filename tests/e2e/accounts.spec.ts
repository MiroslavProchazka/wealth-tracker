import { test, expect } from "@playwright/test";
import { waitForApp } from "./helpers";

test.describe("Bank Accounts (/accounts)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/accounts");
    await waitForApp(page);
  });

  test("zobrazí nadpis stránky", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /account|bank/i })).toBeVisible();
  });

  test("zobrazí tlačítko pro přidání účtu", async ({ page }) => {
    await expect(page.getByRole("button", { name: /add|přidat|\+/i }).first()).toBeVisible();
  });

  test("přidá nový bankovní účet", async ({ page }) => {
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();

    // Název účtu / banky
    const nameInput = page.locator("input[name='name']").first();
    if (await nameInput.isVisible()) await nameInput.fill("Revolut EUR");

    const bankInput = page.locator("input[name='bank']").first();
    if (await bankInput.isVisible()) await bankInput.fill("Revolut");

    // Zůstatek
    const balanceInput = page.locator("input[name='balance']").first();
    if (await balanceInput.isVisible()) await balanceInput.fill("5000");

    // Měna
    const currencySelect = page.locator("select[name='currency']");
    if (await currencySelect.isVisible()) await currencySelect.selectOption("EUR");

    // IBAN
    const ibanInput = page.locator("input[name='iban']").first();
    if (await ibanInput.isVisible()) await ibanInput.fill("CZ6508000000192000145399");

    const submitBtn = page.getByRole("button", { name: /save|uložit|add|submit/i }).last();
    await submitBtn.click();

    await expect(page.getByText("Revolut").or(page.getByText("5 000")).first())
      .toBeVisible({ timeout: 5000 });
  });

  test("stránka se načte bez JS chyb", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test("Bank Accounts odkaz v sidebaru je aktivní", async ({ page }) => {
    const link = page.locator("aside").getByRole("link", { name: /Bank Accounts/i });
    const fontWeight = await link.evaluate((el) =>
      window.getComputedStyle(el).fontWeight
    );
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
  });
});
