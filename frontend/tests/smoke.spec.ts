import { test, expect } from "@playwright/test";

test("landing gates the console", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "See the attack before it lands." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open live console" }).click();
  await expect(page).toHaveURL(/\/console/);
});

test("overview shows KPI cards, analyze panel, queue links, and canvas", async ({ page }) => {
  await page.goto("/console");
  await expect(page.getByRole("heading", { name: "SOC Sentinel — Command Center" })).toBeVisible();
  await expect(page.getByText("alerts processed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Process 3,000 alerts" })).toBeVisible();
  const queueLink = page.locator("a[href^='/incidents/INC-']").first();
  await expect(queueLink).toBeVisible({ timeout: 15000 });
  const hero = page.locator("canvas, [data-testid='graph-fallback'], [data-testid='graph-2d']");
  await expect(hero.first()).toBeVisible({ timeout: 15000 });
});

test("P1 detail shows brief headline and HITL escalate flips status", async ({ page }) => {
  await page.goto("/incidents?severity=P1");
  await expect(page.getByRole("link", { name: "INC-0001" }).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("link", { name: "INC-0001" }).first().click();
  await expect(page.getByText("P1 incident on", { exact: false })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(/status:/)).toBeVisible();
  await expect(page.locator("canvas, [data-testid='graph-fallback'], [data-testid='graph-2d']").first()).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "escalate" }).click();
  await expect(page.getByText(/status:\s*escalated/i)).toBeVisible({ timeout: 15000 });
});

test("matrix cell navigates to filtered incidents", async ({ page }) => {
  await page.goto("/matrix");
  const cell = page.locator("a[href*='technique=']").first();
  await expect(cell).toBeVisible({ timeout: 15000 });
  await cell.click();
  await expect(page).toHaveURL(/technique=/);
});

test("handoff renders section cards", async ({ page }) => {
  await page.goto("/handoff");
  await expect(page.getByText(/Shift Handoff/)).toBeVisible({ timeout: 15000 });
  await expect(page.locator("section.soc-card").first()).toBeVisible({ timeout: 15000 });
});
