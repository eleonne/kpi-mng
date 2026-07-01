import { test, expect } from "@playwright/test";

test("create a KPI, add a field, log a case, and see the dashboard update", async ({ page }) => {
  const kpiName = `E2E Test KPI ${Date.now()}`;

  await page.goto("/kpis/new");
  await page.getByLabel("Name").fill(kpiName);
  await page.getByLabel("Objective").fill("Verify the end-to-end flow works.");
  await page.getByLabel("Target value").fill("3");
  await page.getByRole("button", { name: "Create KPI" }).click();

  await expect(page.getByRole("heading", { name: kpiName })).toBeVisible();

  await page.getByLabel("Label").fill("Project Name");
  await page.getByRole("button", { name: "Add field" }).click();
  await expect(page.getByText("Project Name").first()).toBeVisible();

  // "Log a case" renders as a Button (nativeButton={false}) wrapping a Link,
  // so it's exposed with role="button" to assistive tech, not role="link".
  await page.getByRole("button", { name: "Log a case" }).click();
  await page.getByLabel("Date").fill("2026-01-15");
  await page.getByLabel("Project Name").fill("Invoice Automation");
  await page.getByRole("button", { name: "Log case" }).click();

  await expect(page.getByText("1 / 3")).toBeVisible();

  await page.goto("/");
  const card = page.getByRole("link", { name: new RegExp(kpiName) });
  await expect(card).toBeVisible();
  await expect(card.getByText("1 / 3")).toBeVisible();
});
