import { expect, test, type Page } from "@playwright/test";
import { cleanupTestUsers, email, signUp, sql } from "./helpers";

test.afterAll(cleanupTestUsers);

async function request(page: Page, code: string) {
  await page.goto("/account/request-officer-access");
  await page.getByLabel("Department").selectOption({ index: 1 });
  await page.getByLabel("Job title").fill("HR Officer");
  await page.getByLabel(/Officer or admin code/).fill(code);
  await page.getByRole("button", { name: "Send request" }).click();
}

test("a correct officer code gives access straight away; wrong codes are refused and limited", async ({ page }) => {
  const a = email("code-ok");
  await signUp(page, "Code Officer", a);
  await request(page, "00000");
  await expect(page.getByText("Incorrect code")).toBeVisible();
  await request(page, "12345");
  await expect(page).toHaveURL(/\/portal$/);
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  const [r] = await sql<{ role: string; status: string }>(`select role, status from user_roles where user_id=(select id from "user" where email=$1)`, [a]);
  expect(r).toEqual({ role: "officer", status: "active" });

  // Five wrong guesses lock the next attempt, even with the right code.
  await page.context().clearCookies();
  await signUp(page, "Code Guesser", email("code-guess"));
  for (let i = 0; i < 5; i++) {
    await request(page, `9999${i}`);
    await expect(page.getByText("Incorrect code")).toBeVisible();
  }
  await request(page, "12345");
  await expect(page.getByText("Too many wrong codes")).toBeVisible();
});
