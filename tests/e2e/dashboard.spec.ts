import { test, expect } from "@playwright/test";
import { waitForApp } from "./helpers";

test.describe("/dashboard redirect", () => {
  test("přesměruje /dashboard na /", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBe(200);
    expect(page.url()).toMatch(/\/$/);
  });

  test("přesměruje /dashboard/foo na /", async ({ page }) => {
    const response = await page.goto("/dashboard/foo");
    expect(response?.status()).toBe(200);
    expect(page.url()).toMatch(/\/$/);
  });
});

test.describe("Dashboard (/)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForApp(page);
  });

  test("načte se stránka bez JS chyb", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.waitForTimeout(1000); // Dáme čas na hydrataci
    expect(errors).toHaveLength(0);
  });

  test("zobrazí hlavní nadpis Net Worth", async ({ page }) => {
    await expect(page.getByText(/net worth/i)).toBeVisible();
  });

  test("zobrazí navigační sidebar s 10 položkami", async ({ page }) => {
    const nav = page.locator("aside nav");
    await expect(nav).toBeVisible();
    const links = nav.locator("a");
    await expect(links).toHaveCount(10);
  });

  test("sidebar obsahuje WealthTracker brand", async ({ page }) => {
    await expect(page.getByText(/WealthTracker/)).toBeVisible();
  });

  test("zobrazí sekci Breakdown / alokace aktiv", async ({ page }) => {
    // Stránka by měla mít karty i s prázdnými daty
    await expect(page.getByText(/crypto|stocks|property|savings|accounts/i).first()).toBeVisible();
  });

  test("navigace na Crypto skrze quick link", async ({ page }) => {
    // Klik na Crypto v sidebaru
    await page.locator("aside").getByRole("link", { name: /Crypto/i }).click();
    await expect(page).toHaveURL("/crypto");
  });

  test("navigace na Property skrze sidebar", async ({ page }) => {
    await page.locator("aside").getByRole("link", { name: /Property/i }).click();
    await expect(page).toHaveURL("/property");
  });

  test("zobrazí 'Synced via Evolu' v patičce sidebaru", async ({ page }) => {
    await expect(page.getByText(/Synced via Evolu/)).toBeVisible();
  });

  test("Dashboard je označen jako aktivní v sidebaru", async ({ page }) => {
    // Aktivní odkaz má vyšší font-weight nebo modré pozadí
    const dashLink = page.locator("aside").getByRole("link", { name: /Dashboard/i });
    const fontWeight = await dashLink.evaluate((el) =>
      window.getComputedStyle(el).fontWeight
    );
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
  });
});
