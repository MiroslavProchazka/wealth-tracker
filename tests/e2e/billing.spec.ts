import { test, expect } from "@playwright/test";
import { waitForApp, mockClockifyApi, mockClockifyApiMissing } from "./helpers";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function syncClockify(page: Parameters<typeof waitForApp>[0]) {
  await page.getByRole("button", { name: /sync|clockify|↻/i }).first().click();
  // Wait for loading to finish
  await page.waitForFunction(
    () => !document.querySelector("button[disabled]"),
    { timeout: 6000 }
  ).catch(() => {});
  await page.waitForTimeout(400);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Billing (/billing) — se Clockify daty", () => {
  test.beforeEach(async ({ page }) => {
    await mockClockifyApi(page);
    await page.goto("/billing");
    await waitForApp(page);
  });

  test("zobrazí nadpis stránky", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /billing/i })).toBeVisible();
  });

  test("Billing odkaz v sidebaru je aktivní", async ({ page }) => {
    const link = page.locator("aside").getByRole("link", { name: /Billing/i });
    const fontWeight = await link.evaluate((el) =>
      window.getComputedStyle(el).fontWeight
    );
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
  });

  test("zobrazí tlačítko ↻ Sync Clockify", async ({ page }) => {
    await expect(page.getByRole("button", { name: /sync|clockify|↻/i }).first()).toBeVisible();
  });

  test("zobrazí navigaci měsíce (‹ › šipky)", async ({ page }) => {
    await expect(page.locator("button").filter({ hasText: "‹" }).first()).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "›" }).first()).toBeVisible();
  });

  test("po syncu zobrazí projekty z Clockify", async ({ page }) => {
    await syncClockify(page);
    await expect(page.getByText("Client Alpha")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Client Beta")).toBeVisible({ timeout: 5000 });
  });

  test("zobrazí hodiny pro každý projekt", async ({ page }) => {
    await syncClockify(page);
    // Client Alpha má 12.5h (viz mockClockifyApi v helpers.ts)
    await expect(page.getByText(/12.*h/).first()).toBeVisible({ timeout: 8000 });
  });

  test("zobrazí label 'Nevyfakturováno' u každého projektu", async ({ page }) => {
    await syncClockify(page);
    await expect(page.getByText(/nevyfakturov/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("umožní zadat hodinovou sazbu a uložit nastavení", async ({ page }) => {
    await syncClockify(page);
    await expect(page.getByText("Client Alpha")).toBeVisible({ timeout: 8000 });

    // Najdeme první numerický input (hodinová sazba)
    const rateInput = page.locator("input[type='number']").first();
    await rateInput.clear();
    await rateInput.fill("2000");

    // Zobrazí se "Uložit nastavení"
    const saveBtn = page.getByRole("button", { name: /uložit nastavení|uložit sazbu/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 3000 });
    await saveBtn.click();

    // Stránka zůstane na /billing
    await expect(page).toHaveURL("/billing");
  });

  test("pole 'Počáteční nevyfakturováno' je viditelné", async ({ page }) => {
    await syncClockify(page);
    await expect(page.getByText("Client Alpha")).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(/počáteční nevyfakturov/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("po vyplnění sazby se aktivuje tlačítko Vytvořit fakturu", async ({ page }) => {
    await syncClockify(page);
    await expect(page.getByText("Client Alpha")).toBeVisible({ timeout: 8000 });

    // Nastav sazbu + počáteční zůstatek
    const rateInputs = page.locator("input[type='number']");
    await rateInputs.first().fill("2000");
    // Počáteční zůstatek — nastavíme neprázdnou hodnotu aby bylo nevyfakturováno > 0
    await rateInputs.nth(1).fill("10000");

    // Uložit
    const saveBtn = page.getByRole("button", { name: /uložit nastavení/i }).first();
    if (await saveBtn.isVisible()) await saveBtn.click();
    await page.waitForTimeout(500);

    // Tlačítko Vytvořit fakturu by mělo být aktivní
    const invoiceBtn = page.getByRole("button", { name: /vytvořit fakturu/i }).first();
    await expect(invoiceBtn).toBeVisible({ timeout: 5000 });
    await expect(invoiceBtn).not.toBeDisabled();
  });

  test("otevře invoice modal s předvyplněným popisem a částkou", async ({ page }) => {
    await syncClockify(page);
    await expect(page.getByText("Client Alpha")).toBeVisible({ timeout: 8000 });

    // Nastav sazbu a počáteční zůstatek
    const rateInputs = page.locator("input[type='number']");
    await rateInputs.first().fill("1000");
    await rateInputs.nth(1).fill("5000");
    const saveBtn = page.getByRole("button", { name: /uložit nastavení/i }).first();
    if (await saveBtn.isVisible()) await saveBtn.click();
    await page.waitForTimeout(500);

    // Klikni Vytvořit fakturu
    await page.getByRole("button", { name: /vytvořit fakturu/i }).first().click();

    // Modal otevřen — hledáme popis a částku
    const descInput = page.locator("input[name='description']");
    await expect(descInput).toBeVisible({ timeout: 3000 });
    // Popis by měl být předvyplněný
    const descValue = await descInput.inputValue();
    expect(descValue.length).toBeGreaterThan(0);
  });

  test("vytvoří pohledávku z invoice modalu", async ({ page }) => {
    await syncClockify(page);
    await expect(page.getByText("Client Alpha")).toBeVisible({ timeout: 8000 });

    // Nastav sazbu + počáteční zůstatek aby bylo nevyfakturováno > 0
    const rateInputs = page.locator("input[type='number']");
    await rateInputs.first().fill("500");
    await rateInputs.nth(1).fill("8000");
    const saveBtn = page.getByRole("button", { name: /uložit nastavení/i }).first();
    if (await saveBtn.isVisible()) await saveBtn.click();
    await page.waitForTimeout(500);

    // Otevři modal
    await page.getByRole("button", { name: /vytvořit fakturu/i }).first().click();
    const descInput = page.locator("input[name='description']");
    await expect(descInput).toBeVisible({ timeout: 3000 });

    // Uprav popis a nastav částku
    await descInput.clear();
    await descInput.fill("Faktura test — Client Alpha");
    const amountInput = page.locator("input[name='amount']");
    if (await amountInput.isVisible()) {
      await amountInput.clear();
      await amountInput.fill("8000");
    }

    // Submit
    await page.getByRole("button", { name: /vytvořit pohledávku/i }).click();

    // Pohledávka se zobrazí v tabulce pohledávek
    await expect(page.getByText("Faktura test — Client Alpha")).toBeVisible({ timeout: 5000 });
  });

  test("zobrazí sekci Pohledávky na stránce", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /pohledávky/i })).toBeVisible();
  });

  test("invoice modal validuje prázdný popis", async ({ page }) => {
    await syncClockify(page);
    await expect(page.getByText("Client Alpha")).toBeVisible({ timeout: 8000 });

    const rateInputs = page.locator("input[type='number']");
    await rateInputs.first().fill("1000");
    await rateInputs.nth(1).fill("5000");
    const saveBtn = page.getByRole("button", { name: /uložit nastavení/i }).first();
    if (await saveBtn.isVisible()) await saveBtn.click();
    await page.waitForTimeout(500);

    await page.getByRole("button", { name: /vytvořit fakturu/i }).first().click();
    const descInput = page.locator("input[name='description']");
    await expect(descInput).toBeVisible({ timeout: 3000 });

    // Vymaž popis a submit
    await descInput.clear();
    await page.getByRole("button", { name: /vytvořit pohledávku/i }).click();

    // Chybová hláška
    await expect(page.getByText(/povinný|required|popis/i).first()).toBeVisible({ timeout: 3000 });
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

  test("zobrazí instrukce pro nastavení CLOCKIFY_API_KEY", async ({ page }) => {
    await syncClockify(page);
    await expect(
      page.getByText(/CLOCKIFY_API_KEY|api.?key|klíč/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test("stránka se načte bez chyb i bez API klíče", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });
});
