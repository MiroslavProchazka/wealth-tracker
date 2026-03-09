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

  test("zobrazí navigační sidebar s 7 položkami", async ({ page }) => {
    const nav = page.locator("aside nav");
    await expect(nav).toBeVisible();
    const links = nav.locator("a");
    await expect(links).toHaveCount(7);
  });

  test("sidebar obsahuje WealthTracker brand", async ({ page }) => {
    await expect(page.getByText(/WealthTracker/)).toBeVisible();
  });

  test("zobrazí sekci Breakdown / alokace aktiv", async ({ page }) => {
    // Stránka by měla mít karty i s prázdnými daty
    await expect(page.getByText(/crypto|stocks|property|savings|accounts/i).first()).toBeVisible();
  });

  test("target vs actual sekce je skrytá, dokud se funkce nepovolí", async ({ page }) => {
    await expect(
      page.getByText(/target vs actual allocation|cílová vs\. skutečná alokace/i),
    ).toHaveCount(0);

    await page.goto("/settings");
    await waitForApp(page);
    await page
      .getByLabel(
        /Enable Target vs Actual Allocation feature|Povolit funkci Cílová vs\. skutečná alokace/i,
      )
      .check();

    await page.goto("/");
    await waitForApp(page);
    await expect(
      page.getByText(/target vs actual allocation|cílová vs\. skutečná alokace/i),
    ).toBeVisible();
  });

  test("portfolio notes sekce je skrytá, dokud se funkce nepovolí", async ({ page }) => {
    await page.goto("/settings");
    await waitForApp(page);
    await page
      .getByLabel(
        /Show Portfolio Notes on dashboard|Zobrazovat Portfolio poznámky na dashboardu/i,
      )
      .uncheck();

    await page.goto("/");
    await waitForApp(page);
    await expect(
      page.getByRole("heading", { name: /portfolio notes|portfolio poznámky/i }),
    ).toHaveCount(0);

    await page.goto("/settings");
    await waitForApp(page);
    await page
      .getByLabel(
        /Show Portfolio Notes on dashboard|Zobrazovat Portfolio poznámky na dashboardu/i,
      )
      .check();

    await page.goto("/");
    await waitForApp(page);
    await expect(
      page.getByRole("heading", { name: /portfolio notes|portfolio poznámky/i }),
    ).toBeVisible();
  });

  test("tag cloud sekce je skrytá, dokud se funkce nepovolí", async ({ page }) => {
    await page.goto("/settings");
    await waitForApp(page);
    await page
      .getByLabel(/Show Tag Cloud on dashboard|Zobrazovat Tag cloud na dashboardu/i)
      .uncheck();

    await page.goto("/");
    await waitForApp(page);
    await expect(
      page.getByRole("heading", { name: /tag cloud/i }),
    ).toHaveCount(0);

    await page.goto("/settings");
    await waitForApp(page);
    await page
      .getByLabel(/Show Tag Cloud on dashboard|Zobrazovat Tag cloud na dashboardu/i)
      .check();

    await page.goto("/");
    await waitForApp(page);
    await expect(
      page.getByRole("heading", { name: /tag cloud/i }),
    ).toBeVisible();
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
    const dashLink = page.locator("aside").getByRole("link", { name: /Dashboard/i });
    const fontWeight = await dashLink.evaluate((el) =>
      window.getComputedStyle(el).fontWeight
    );
    expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
  });

  test("Net Worth karta používá design system tokeny (ne hardcoded barvy)", async ({ page }) => {
    // Net Worth karta má borderColor nastavený přes CSS proměnnou, ne hardcoded hex
    const card = page.locator(".card").first();
    await expect(card).toBeVisible();
    const borderColor = await card.evaluate((el) =>
      (el as HTMLElement).style.borderColor
    );
    // borderColor by mělo být prázdné (nastaveno CSS proměnnou) nebo obsahovat var()
    expect(borderColor).not.toMatch(/#[0-9a-fA-F]{3,6}/);
  });

  test("horní summary dlaždice pro sekce jsou klikatelné", async ({ page }) => {
    const statGrid = page.locator(".stat-grid");
    await expect(statGrid.getByRole("link", { name: /savings/i })).toBeVisible();
    await expect(statGrid.getByRole("link", { name: /property/i })).toBeVisible();
    await expect(statGrid.getByRole("link", { name: /stocks|akcie/i })).toBeVisible();
    await expect(statGrid.getByRole("link", { name: /receivables/i })).toHaveCount(0);
    await expect(statGrid.getByRole("link", { name: /crypto/i })).toBeVisible();
    await expect(page.getByText("Quick Access")).toHaveCount(0);
  });

  test("klik na Property summary dlaždici otevře property stránku", async ({ page }) => {
    await page.locator(".stat-grid").getByRole("link", { name: /property/i }).click();
    await expect(page).toHaveURL("/property");
  });

  test("klik na Stocks summary dlaždici otevře stocks stránku", async ({ page }) => {
    await page.locator(".stat-grid").getByRole("link", { name: /stocks|akcie/i }).click();
    await expect(page).toHaveURL("/stocks");
  });

  test("aktivní sidebar odkaz má gradient pozadí", async ({ page }) => {
    const dashLink = page.locator("aside").getByRole("link", { name: /Dashboard/i });
    const bg = await dashLink.evaluate((el) =>
      (el as HTMLElement).style.background
    );
    expect(bg).toMatch(/gradient/);
  });

  test("přidá a upraví portfolio note", async ({ page }) => {
    await page.getByRole("button", { name: /\+\s*Add Note/i }).click();
    await page.locator("input[name='title']").fill("Rebalance Q2");
    await page.locator("textarea[name='body']").fill("Trim US tech and increase cash.");
    await page.locator("input[name='tags']").fill("rebalance,cash");
    await page.getByRole("button", { name: /Save Note/i }).click();
    await expect(page.locator("input[name='title']")).toHaveCount(0);
    await page.reload();
    await waitForApp(page);

    const noteCard = page.getByText("Rebalance Q2").locator("..").locator("..");
    await expect(noteCard).toBeVisible();
    await expect(noteCard).toContainText("#rebalance");
    await noteCard.getByRole("button", { name: /Edit/i }).click();
    await expect(page.locator("input[name='title']")).toHaveValue("Rebalance Q2");
    await page.locator("textarea[name='body']").fill("Trim US tech and add Europe exposure.");
    await page.getByRole("button", { name: /Save Changes/i }).click();
    await expect(page.locator("input[name='title']")).toHaveCount(0);
    await page.reload();
    await waitForApp(page);

    await expect(page.getByText("Trim US tech and add Europe exposure.")).toBeVisible();
  });
});
