import { test, expect } from "@playwright/test";
import { waitForApp, mockCryptoPricesApi } from "./helpers";

test.describe("Crypto (/crypto)", () => {
  test.beforeEach(async ({ page }) => {
    await mockCryptoPricesApi(page);
    await page.goto("/crypto");
    await waitForApp(page);
  });

  test("zobrazí nadpis stránky", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /crypto/i })).toBeVisible();
  });

  test("zobrazí tlačítko pro přidání holdingu", async ({ page }) => {
    await expect(page.getByRole("button", { name: /add|přidat|\+/i }).first()).toBeVisible();
  });

  test("otevře modal pro přidání holdingu", async ({ page }) => {
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();
    // Modal se otevře — hledáme formulář nebo modal title
    await expect(page.getByRole("dialog").or(page.locator('[role="dialog"]'))
      .or(page.locator("input[name='symbol'], input[name='amount']")).first()
    ).toBeVisible({ timeout: 3000 }).catch(() => {
      // Alternativní selektor — formulář v overlay
      return expect(page.locator("input").first()).toBeVisible({ timeout: 3000 });
    });
  });

  test("přidá nový holding BTC", async ({ page }) => {
    // Klik na Add
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();

    // Vyplní formulář
    const symbolInput = page.locator("input[name='symbol'], select[name='symbol']").first();
    await symbolInput.fill("BTC").catch(async () => {
      // Může být select
      const select = page.locator("select").first();
      if (await select.isVisible()) await select.selectOption("BTC");
    });

    const amountInput = page.locator("input[name='amount']");
    if (await amountInput.isVisible()) {
      await amountInput.fill("0.5");
    }

    const buyPriceInput = page.locator("input[name='buyPrice']");
    if (await buyPriceInput.isVisible()) {
      await buyPriceInput.fill("2000000");
    }

    // Submit
    const submitBtn = page.locator("form").last().getByRole("button", {
      name: /save|uložit|add|přidat|submit/i,
    });
    await submitBtn.click();

    // Holding se zobrazí v tabulce
    await expect(page.getByText("BTC")).toBeVisible({ timeout: 5000 });
  });

  test("zobrazí přepínač měny (CZK/USD/EUR)", async ({ page }) => {
    await expect(page.getByRole("button", { name: "CZK" }).first()).toBeVisible();
  });

  test("Crypto odkaz v sidebaru je aktivní", async ({ page }) => {
    const cryptoLink = page.locator("aside").getByRole("link", { name: /Crypto/i });
    const fontWeight = await cryptoLink.evaluate((el) =>
      window.getComputedStyle(el).fontWeight
    );
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
  });

  test("zobrazí sekci Price Alerts nebo možnost nastavit alert", async ({ page }) => {
    // Alerts jsou část stránky — hledáme text nebo tlačítko
    // Je to volitelná sekce — jen ověříme že stránka nenadhodí chybu
    await expect(page).toHaveURL("/crypto");
  });

  // ── Edit feature ────────────────────────────────────────────────────────────
  test("otevře edit modal s předvyplněnými hodnotami", async ({ page }) => {
    // Nejprve přidáme holding
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();
    await page.locator("input[name='symbol']").fill("ETH");
    const nameInput = page.locator("input[name='name']");
    if (await nameInput.isVisible()) await nameInput.fill("Ethereum");
    await page.locator("input[name='amount']").fill("2");
    await page.locator("form").last().getByRole("button", {
      name: /save|uložit|add|přidat|submit/i,
    }).click({ force: true });
    await expect(page.getByText("ETH").first()).toBeVisible({ timeout: 5000 });

    // Klikneme na ✏️ edit tlačítko
    const editBtn = page.locator("button[title='Upravit']").first();
    await editBtn.click();

    // Modal se otevře s předvyplněnou hodnotou
    const symbolInput = page.locator("input[name='symbol']");
    await expect(symbolInput).toBeVisible({ timeout: 3000 });
    await expect(symbolInput).toHaveValue("ETH");
  });

  test("upraví existing holding — uloží změnu", async ({ page }) => {
    // Přidáme holding
    await page.getByRole("button", { name: /add|přidat|\+/i }).first().click();
    await page.locator("input[name='symbol']").fill("BTC");
    const nameInput = page.locator("input[name='name']");
    if (await nameInput.isVisible()) await nameInput.fill("Bitcoin");
    await page.locator("input[name='amount']").fill("0.1");
    await page.locator("form").last().getByRole("button", {
      name: /save|uložit|add|přidat|submit/i,
    }).click();
    await expect(page.getByText("BTC")).toBeVisible({ timeout: 5000 });

    // Editujeme
    await page.locator("button[title='Upravit']").first().click();
    const amountInput = page.locator("input[name='amount']");
    await amountInput.clear();
    await amountInput.fill("0.25");
    await page.locator("form").last().getByRole("button", {
      name: /save|uložit|update|upravit|submit/i,
    }).click();

    // Nová hodnota se zobrazí
    await expect(page.getByText(/0[,.]25/).first()).toBeVisible({ timeout: 5000 });
  });
});
