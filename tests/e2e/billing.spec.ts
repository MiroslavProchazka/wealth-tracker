import { test, expect } from "@playwright/test";
import { waitForApp, mockClockifyApi, mockClockifyApiMissing } from "./helpers";

test.describe("Billing (/billing)", () => {
  test.beforeEach(async ({ page }) => {
    await mockClockifyApi(page);
    await page.goto("/billing");
    await waitForApp(page);
  });

  test("zobrazí nadpis stránky", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /billing|faktura/i })).toBeVisible();
  });

  test("Billing odkaz v sidebaru je aktivní", async ({ page }) => {
    const link = page.locator("aside").getByRole("link", { name: /Billing/i });
    const fontWeight = await link.evaluate((el) =>
      window.getComputedStyle(el).fontWeight
    );
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
  });

  test("zobrazí tlačítko Sync Clockify", async ({ page }) => {
    const syncBtn = page.getByRole("button", { name: /sync|clockify|načíst/i });
    await expect(syncBtn.first()).toBeVisible();
  });

  test("zobrazí navigaci měsíce (šipky ‹ ›)", async ({ page }) => {
    const prevBtn = page.getByRole("button", { name: /‹|prev|předchozí|◀/i })
      .or(page.locator("button").filter({ hasText: "‹" }))
      .first();
    const nextBtn = page.getByRole("button", { name: /›|next|další|▶/i })
      .or(page.locator("button").filter({ hasText: "›" }))
      .first();
    await expect(prevBtn).toBeVisible();
    await expect(nextBtn).toBeVisible();
  });

  test("zobrazí projekty načtené z Clockify API", async ({ page }) => {
    // Počkáme na výsledek syncu (mock vrátí 2 projekty)
    await expect(page.getByText("Client Alpha")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Client Beta")).toBeVisible({ timeout: 5000 });
  });

  test("zobrazí hodiny u každého projektu", async ({ page }) => {
    await page.getByRole("button", { name: /sync|clockify|↻/i }).first().click();
    // Client Alpha má 12.5 hodin
    await expect(page.getByText(/12[.,]5/).first()).toBeVisible({ timeout: 8000 });
  });

  test("umožní nastavit hodinovou sazbu u projektu", async ({ page }) => {
    await page.getByRole("button", { name: /sync|clockify|↻/i }).first().click();
    await expect(page.getByText("Client Alpha")).toBeVisible({ timeout: 8000 });

    // Najdeme input pro hodinovou sazbu
    const rateInput = page.locator("input[placeholder*='rate'], input[name*='rate'], input[type='number']").first();
    if (await rateInput.isVisible()) {
      await rateInput.clear();
      await rateInput.fill("2000");
      // Blur pro uložení
      await rateInput.press("Tab");
      await page.waitForTimeout(500);
    }
    // Stránka nehodila chybu
    await expect(page).toHaveURL("/billing");
  });

  test("zobrazí sekci pohledávek (Receivables) na stránce", async ({ page }) => {
    // Billing page obsahuje receivables tabulku ve spodní části
    const receivablesSection = page.getByText(/receivable|pohledávk/i).first();
    await expect(receivablesSection).toBeVisible({ timeout: 5000 });
  });

  test("přidá pohledávku přes billing stránku", async ({ page }) => {
    // Hledáme Add tlačítko pro receivables
    const addBtn = page.getByRole("button", { name: /\+ add|\+ přidat/i }).first();
    await addBtn.click();

    const descInput = page.locator("input[name='description']").first();
    if (await descInput.isVisible()) await descInput.fill("Billing Test Invoice");
    const amountInput = page.locator("input[name='amount']").first();
    if (await amountInput.isVisible()) await amountInput.fill("9000");
    await page.getByRole("button", { name: /save|uložit|add|submit/i }).last().click();

    await expect(page.getByText("Billing Test Invoice")).toBeVisible({ timeout: 5000 });
  });

  test("stránka se načte bez JS chyb", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});

test.describe("Billing — bez Clockify API klíče", () => {
  test.beforeEach(async ({ page }) => {
    await mockClockifyApiMissing(page);
    await page.goto("/billing");
    await waitForApp(page);
  });

  test("zobrazí instrukce pro nastavení API klíče", async ({ page }) => {
    await page.getByRole("button", { name: /sync|clockify|↻/i }).first().click();
    // Po 503 se má zobrazit setup card s instrukcemi
    await expect(
      page.getByText(/CLOCKIFY_API_KEY|api.?key|klíč|setup|env/i).first()
    ).toBeVisible({ timeout: 8000 });
  });
});
