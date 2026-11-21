import path from "node:path";
import { config } from "dotenv";
import { expect, test, type Page } from "@playwright/test";
import { cleanupTestUsers, email, signUp, sql } from "./helpers";

config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });
const ADMIN_CODE = process.env.ADMIN_CODE ?? "";

test.afterAll(cleanupTestUsers);

async function enterCode(page: Page, code: string) {
  await page.goto("/account/request-officer-access");
  await page.getByLabel("Department").selectOption({ index: 1 });
  await page.getByLabel("Job title").fill("Manager");
  await page.getByLabel(/code/i).fill(code);
  await page.getByRole("button", { name: "Send request" }).click();
}

test("admin code makes an admin; admins can make and remove other admins", async ({ page }) => {
  test.skip(!ADMIN_CODE, "ADMIN_CODE not set in .env");
  const person = email("person");
  await signUp(page, "Plain Person", person);

  await page.context().clearCookies();
  const boss = email("boss");
  await signUp(page, "Code Admin", boss);
  await enterCode(page, ADMIN_CODE);
  await expect(page).toHaveURL(/\/admin\/users/);
  await expect(page.getByRole("heading", { name: "Manage users" })).toBeVisible();

  const row = page.locator("tr", { hasText: person });
  await row.getByRole("button", { name: "Make admin" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Make admin" }).click();
  await expect(page.locator("tr", { hasText: person }).getByRole("button", { name: "Remove admin" })).toBeVisible();
  let [r] = await sql<{ role: string }>(`select role from user_roles where user_id=(select id from "user" where email=$1)`, [person]);
  expect(r.role).toBe("admin");

  await page.locator("tr", { hasText: person }).getByRole("button", { name: "Remove admin" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove admin" }).click();
  await expect(page.locator("tr", { hasText: person }).getByRole("button", { name: "Make admin" })).toBeVisible();
  [r] = await sql<{ role: string }>(`select role from user_roles where user_id=(select id from "user" where email=$1)`, [person]);
  expect(r.role).toBe("applicant");

  // Your own row has no admin button.
  await expect(page.locator("tr", { hasText: boss }).getByRole("button", { name: /admin/i })).toHaveCount(0);
});
