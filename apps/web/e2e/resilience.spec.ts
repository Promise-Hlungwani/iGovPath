import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeAdmin, signUp, sql } from "./helpers";

test.afterAll(cleanupTestUsers);

test("a failing action shows a message instead of crashing the app", async ({ page }) => {
  // Someone waiting for officer approval.
  const waiting = email("waiting");
  await signUp(page, "Waiting Person", waiting);
  await sql(
    `update user_roles set role='officer', status='pending', department_id=(select id from departments limit 1), requested_at=now()
     where user_id=(select id from "user" where email=$1)`, [waiting]);

  // Admin approves with a broken form value.
  await page.context().clearCookies();
  const admin = email("resilience-admin");
  await signUp(page, "Resilience Admin", admin);
  await makeAdmin(admin);
  await page.goto("/admin/users");
  const card = page.locator("div", { hasText: "Waiting Person" }).filter({ has: page.getByRole("button", { name: "Approve" }) }).last();
  await card.locator("select").evaluate((sel: HTMLSelectElement) => {
    const o = document.createElement("option"); o.value = "not-a-number"; o.text = "broken"; sel.add(o); sel.value = "not-a-number";
  });
  await card.getByRole("button", { name: "Approve" }).click();

  await expect(page.getByRole("alert").filter({ hasText: /missing or not valid/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Manage users" })).toBeVisible(); // still on a working page
  await page.goto("/search");
  await expect(page.getByRole("heading", { name: /Find/ })).toBeVisible(); // app keeps working
});
