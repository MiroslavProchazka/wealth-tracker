import { test, expect } from "@playwright/test";
import { waitForApp } from "./helpers";

test.describe("Settings (/settings)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
    await waitForApp(page);
  });

  test("snapshot automation toggle persists after reload", async ({ page }) => {
    const toggle = page.getByLabel(/Enable daily snapshot on app open \/ day change/i);
    await expect(toggle).toBeChecked();
    await toggle.uncheck();
    await page.reload();
    await waitForApp(page);
    await expect(page.getByLabel(/Enable daily snapshot on app open \/ day change/i)).not.toBeChecked();
  });

  test("target allocation update is reflected on dashboard", async ({ page }) => {
    const savingsTargetInput = page.getByRole("spinbutton").nth(1);
    await savingsTargetInput.fill("40");
    await savingsTargetInput.blur();
    await expect(page.getByText(/Target allocations updated\./i)).toBeVisible();

    await page.goto("/savings");
    await waitForApp(page);
    await page.getByRole("button", { name: /\+\s*Add Account/i }).click();
    await page.locator("input[name='name']").fill("Reserve Fund");
    await page.locator("input[name='bank']").fill("Moneta");
    await page.locator("input[name='balance']").fill("100000");
    await page.getByRole("button", { name: /Add Account|Save|Uložit/i }).last().click();

    await page.goto("/");
    await waitForApp(page);
    await expect(page.getByText(/actual 100\.0% · target 40\.0%/i)).toBeVisible();
  });
});
