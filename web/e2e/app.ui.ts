/**
 * UI e2e: Privy email login (test account) → onboarding (test funds + handle + on-chain profile) → key pages.
 * Requires `pnpm dev` and http://localhost:3010 in the Privy app's allowed origins.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(__dirname, "../../.env.local") });
import { expect, test } from "@playwright/test";

test("sign in, onboard and browse", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("sign-in").click();
  const email = page.locator('input[type="email"]');
  await email.waitFor({ timeout: 30_000 });
  await email.fill(process.env.E2E_PRIVY_EMAIL!);
  await page.keyboard.press("Enter");
  const firstOtp = page.locator('input[autocomplete="one-time-code"], input[name="code-0"], input[inputmode="numeric"]').first();
  await firstOtp.waitFor({ timeout: 30_000 });
  await firstOtp.click();
  await page.keyboard.type(process.env.E2E_PRIVY_CODE!, { delay: 60 });
  await expect(page.getByTestId("user-menu").or(page.getByTestId("handle")).first()).toBeVisible({ timeout: 90_000 });

  // New accounts are redirected to onboarding once /api/me resolves.
  await page.waitForTimeout(4000);
  if (page.url().includes("/onboarding") || (await page.getByTestId("handle").isVisible().catch(() => false))) {
    await page.getByTestId("handle").waitFor();
    const funds = page.getByTestId("onboarding-funds");
    if (await funds.isVisible().catch(() => false)) {
      await funds.click();
      await expect(funds).toBeHidden({ timeout: 60_000 });
    }
    await page.getByTestId("handle").fill(`ui-${Date.now().toString(36)}`);
    await page.getByTestId("save-handle").click();
    await expect(page).not.toHaveURL(/onboarding/, { timeout: 120_000 });
  }

  await page.goto("/wallet");
  await expect(page.getByTestId("sui-address")).toContainText("0x", { timeout: 30_000 });

  await page.goto("/");
  const card = page.getByTestId("space-card").first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.click();
  await expect(page.getByText("Ad-Space Quality Score")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Verify on-chain")).toBeVisible();

  for (const path of ["/dashboard", "/offerings", "/messages", "/brand-kit", "/verify", "/agents", "/list"]) {
    await page.goto(path);
    await expect(page.locator("main")).not.toContainText("Application error", { timeout: 20_000 });
  }
});
