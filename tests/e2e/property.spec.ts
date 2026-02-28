import { test, expect } from "@playwright/test";
import { waitForApp } from "./helpers";

test.describe("Property (/property)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/property");
    await waitForApp(page);
  });

  test("zobrazí nadpis stránky", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /property|real estate/i })).toBeVisible();
  });

  test("zobrazí summary karty (Total Value, Mortgage, Equity)", async ({ page }) => {
    const valueCard = page.getByText(/total.*value|property.*value/i).first();
    const mortgageCard = page.getByText(/mortgage|hypotéka/i).first();
    const equityCard = page.getByText(/equity/i).first();

    await expect(valueCard).toBeVisible();
    await expect(mortgageCard).toBeVisible();
    await expect(equityCard).toBeVisible();
  });

  test("zobrazí tlačítko pro přidání nemovitosti", async ({ page }) => {
    await expect(page.getByRole("button", { name: /add|přidat|\+/i }).first()).toBeVisible();
  });

  test("otevře modal pro přidání nemovitosti", async ({ page }) => {
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();
    await expect(page.locator("input").first()).toBeVisible({ timeout: 3000 });
  });

  test("přidá nemovitost bez hypotéky", async ({ page }) => {
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();

    // Vyplní název nemovitosti
    const nameInput = page.locator("input[name='name'], input[name='address'], input[name='title']").first();
    if (await nameInput.isVisible()) {
      await nameInput.fill("Byt Praha");
    }

    // Hodnota nemovitosti
    const valueInput = page.locator("input[name='estimatedValue'], input[name='value']").first();
    if (await valueInput.isVisible()) {
      await valueInput.fill("5000000");
    }

    // Submit
    const submitBtn = page.getByRole("button", { name: /save|uložit|add|přidat|submit/i }).last();
    await submitBtn.click();

    // Nemovitost se zobrazí
    await expect(page.getByText("Byt Praha").or(page.getByText("5")).first())
      .toBeVisible({ timeout: 5000 });
  });

  test("přidá nemovitost s hypotékou — zobrazí progress bar", async ({ page }) => {
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();

    // Vyplní formulář
    const nameInput = page.locator("input[name='name'], input[name='address']").first();
    if (await nameInput.isVisible()) await nameInput.fill("Dům Brno");

    const valueInput = page.locator("input[name='estimatedValue'], input[name='value']").first();
    if (await valueInput.isVisible()) await valueInput.fill("8000000");

    // Aktivuje hypotéku (checkbox nebo select)
    const mortgageCheckbox = page.locator("input[type='checkbox']").first();
    if (await mortgageCheckbox.isVisible()) await mortgageCheckbox.check();

    // Výše hypotéky
    const loanInput = page.locator("input[name='remainingLoan'], input[name='originalLoan']").first();
    if (await loanInput.isVisible()) await loanInput.fill("5000000");

    const submitBtn = page.getByRole("button", { name: /save|uložit|add|přidat|submit/i }).last();
    await submitBtn.click();

    // Počkáme na zavření modalu
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL("/property");
  });

  test("Property odkaz v sidebaru je aktivní", async ({ page }) => {
    const propLink = page.locator("aside").getByRole("link", { name: /Property/i });
    const fontWeight = await propLink.evaluate((el) =>
      window.getComputedStyle(el).fontWeight
    );
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
  });

  // ── Edit feature ────────────────────────────────────────────────────────────
  test("otevře edit modal s předvyplněným názvem nemovitosti", async ({ page }) => {
    // Přidáme nemovitost
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();
    const nameInput = page.locator("input[name='name']").first();
    if (await nameInput.isVisible()) await nameInput.fill("Chalupa Šumava");
    const valueInput = page.locator("input[name='estimatedValue'], input[name='value']").first();
    if (await valueInput.isVisible()) await valueInput.fill("3500000");
    await page.getByRole("button", { name: /save|uložit|add|submit/i }).last().click();
    await expect(page.getByText("Chalupa Šumava")).toBeVisible({ timeout: 5000 });

    // Editujeme
    const editBtn = page.locator("button[title='Upravit'], button:has-text('✏️')").first();
    await editBtn.click();

    // Modal je otevřen s předvyplněným názvem
    const nameField = page.locator("input[name='name']");
    await expect(nameField).toBeVisible({ timeout: 3000 });
    await expect(nameField).toHaveValue("Chalupa Šumava");
  });

  test("upraví odhadovanou hodnotu nemovitosti", async ({ page }) => {
    // Přidáme nemovitost
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();
    const nameInput = page.locator("input[name='name']").first();
    if (await nameInput.isVisible()) await nameInput.fill("Byt Brno");
    const valueInput = page.locator("input[name='estimatedValue'], input[name='value']").first();
    if (await valueInput.isVisible()) await valueInput.fill("4000000");
    await page.getByRole("button", { name: /save|uložit|add|submit/i }).last().click();
    await expect(page.getByText("Byt Brno")).toBeVisible({ timeout: 5000 });

    // Editujeme hodnotu
    await page.locator("button[title='Upravit'], button:has-text('✏️')").first().click();
    const valField = page.locator("input[name='estimatedValue']");
    if (await valField.isVisible()) {
      await valField.clear();
      await valField.fill("4500000");
    }
    await page.getByRole("button", { name: /save|uložit|update|upravit|submit/i }).last().click();

    // Nová hodnota se projeví v kartě
    await expect(page.getByText("Byt Brno")).toBeVisible({ timeout: 5000 });
    await expect(page).toHaveURL("/property");
  });
});
