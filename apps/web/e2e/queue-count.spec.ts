import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeOfficer, signUp, sql } from "./helpers";

test.afterAll(cleanupTestUsers);

test("officers see how many records wait for review: header, menu, account page, portal tab", async ({ page }) => {
  const dept = "State Information Technology Agency (SITA)";
  const [{ n }] = await sql<{ n: number }>(
    `select count(*)::int n from extractions where status in ('draft','needs_fix') and department_id=(select id from departments where name=$1)`, [dept]);
  test.skip(n === 0, "no drafts waiting in this department");

  const o = email("queue");
  await signUp(page, "Queue Officer", o);
  await makeOfficer(o, dept);
  await page.goto("/portal"); // officer profile: the count is in the top menu
  await expect(page.getByTestId("queue-count")).toContainText(String(n));
  await page.goto("/account");
  await expect(page.getByTestId("queue-card")).toContainText(`${n} ${n === 1 ? "record is" : "records are"} waiting for your approval`);
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(page.getByRole("menuitem", { name: /Review queue/ })).toContainText(`${n} waiting`);
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Go to review queue" }).click();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  await expect(page.getByTestId("queue-item")).toHaveCount(n);
});
