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

  // ── Edit feature ────────────────────────────────────────────────────────────
  test("otevře edit modal s předvyplněnými hodnotami bankovního účtu", async ({ page }) => {
    // Přidáme účet
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();
    const nameInput = page.locator("input[name='name']").first();
    if (await nameInput.isVisible()) await nameInput.fill("Wise USD");
    const bankInput = page.locator("input[name='bank']").first();
    if (await bankInput.isVisible()) await bankInput.fill("Wise");
    const balanceInput = page.locator("input[name='balance']").first();
    if (await balanceInput.isVisible()) await balanceInput.fill("2000");
    const currencySelect = page.locator("select[name='currency']");
    if (await currencySelect.isVisible()) await currencySelect.selectOption("USD");
    await page.getByRole("button", { name: /save|uložit|add|submit/i }).last().click();
    await expect(page.getByText("Wise USD")).toBeVisible({ timeout: 5000 });

    // Editujeme
    const editBtn = page.locator("button[title='Upravit'], button:has-text('✏️')").first();
    await editBtn.click();

    // Modal je otevřen s předvyplněným názvem
    const nameField = page.locator("input[name='name']");
    await expect(nameField).toBeVisible({ timeout: 3000 });
    await expect(nameField).toHaveValue("Wise USD");
  });

  test("upraví zůstatek bankovního účtu", async ({ page }) => {
    // Přidáme účet
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();
    const nameInput = page.locator("input[name='name']").first();
    if (await nameInput.isVisible()) await nameInput.fill("Moneta CZK");
    const bankInput = page.locator("input[name='bank']").first();
    if (await bankInput.isVisible()) await bankInput.fill("Moneta");
    const balanceInput = page.locator("input[name='balance']").first();
    if (await balanceInput.isVisible()) await balanceInput.fill("30000");
    await page.getByRole("button", { name: /save|uložit|add|submit/i }).last().click();
    await expect(page.getByText("Moneta CZK")).toBeVisible({ timeout: 5000 });

    // Editujeme zůstatek
    await page.locator("button[title='Upravit'], button:has-text('✏️')").first().click();
    const balField = page.locator("input[name='balance']");
    if (await balField.isVisible()) {
      await balField.clear();
      await balField.fill("45000");
    }
    await page.getByRole("button", { name: /save|uložit|update|upravit|submit/i }).last().click();

    // Účet stále viditelný
    await expect(page.getByText("Moneta CZK")).toBeVisible({ timeout: 5000 });
  });
});
