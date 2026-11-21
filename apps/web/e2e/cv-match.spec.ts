import path from "node:path";
import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, signUp, sql } from "./helpers";

test.afterAll(cleanupTestUsers);

test("upload a CV, AI finds posts with reasons; personal details are never stored", async ({ page }) => {
  const mail = email("cv");
  await signUp(page, "CV Tester", mail);
  await page.goto("/match");

  // Consent is required.
  await page.getByLabel("Your CV").setInputFiles(path.join(__dirname, "fixtures/sample-cv-fictional.pdf"));
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Find posts for me" }).click();

  // Summary and matches appear.
  await expect(page.getByTestId("cv-summary")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("cv-summary")).toContainText(/Grade 12|Senior Certificate/i);
  const matches = page.getByTestId("match");
  expect(await matches.count()).toBeGreaterThan(0);
  const all = await page.locator("main").innerText();
  expect(all).toMatch(/Stores|Switchboard|Driver|Clerk/i);
  expect(all.toLowerCase()).not.toContain("eligible");

  // Nothing personal was stored.
  const [row] = await sql<{ p: string; m: string }>(
    `select cv_profile::text p, cv_matches::text m from applicant_profiles where user_id=(select id from "user" where email=$1)`,
    [mail],
  );
  for (const secret of ["Sipho", "Mthembu", "9506225123081", "22/06/1995", "Church Road", "082 444 7788", "sipho.sample@example.com"]) {
    expect(row.p + row.m).not.toContain(secret);
  }

  // Remove CV details.
  await page.getByRole("button", { name: "Remove my CV details" }).click();
  await expect(page.getByText("Your CV details have been removed.")).toBeVisible();
  const left = await sql(`select 1 from applicant_profiles where user_id=(select id from "user" where email=$1)`, [mail]);
  expect(left.length).toBe(0);
});
