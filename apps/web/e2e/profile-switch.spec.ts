import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeOfficer, signUp } from "./helpers";

test.afterAll(cleanupTestUsers);

test("officers switch between their personal profile and officer profile; the active page is highlighted", async ({ page }) => {
  const o = email("profile");
  await signUp(page, "Profile Officer", o);
  await makeOfficer(o, "State Information Technology Agency (SITA)");
  const header = page.locator("header");

  // Personal profile: applicant links only.
  await page.goto("/search");
  await expect(header.getByRole("link", { name: "Find opportunities" })).toHaveAttribute("aria-current", "page");
  await expect(header.getByRole("link", { name: /Officer portal/ })).toHaveCount(0);

  // Switch to the officer profile from the avatar menu.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitemradio", { name: /Officer profile/ }).click();
  await expect(page).toHaveURL(/\/portal$/);
  await expect(header.getByRole("link", { name: /Officer portal/ })).toHaveAttribute("aria-current", "page");
  await expect(header.getByRole("link", { name: "Find opportunities" })).toHaveCount(0);
  await page.getByRole("link", { name: "Forms", exact: true }).click();
  await expect(page.getByRole("link", { name: "Forms", exact: true })).toHaveAttribute("aria-current", "page");

  // And back to the personal profile.
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menuitemradio", { name: /Officer profile/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "Personal profile" }).click();
  await expect(page).toHaveURL(/\/search$/);
  await expect(header.getByRole("link", { name: /Officer portal/ })).toHaveCount(0);
  await expect(header.getByRole("link", { name: "My applications" })).toBeVisible();
});
