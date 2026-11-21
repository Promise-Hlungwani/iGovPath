import path from "node:path";
import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeOfficer, signIn, signUp, sql } from "./helpers";

const CV = path.join(__dirname, "fixtures/sample-cv-fictional.pdf");
test.afterAll(cleanupTestUsers);

test("apply inside iGovPath, officer updates the status, applicant sees it", async ({ page }) => {
  test.setTimeout(300_000);
  const [opp] = await sql<{ id: string; dept: string; title: string }>(
    `select o.id, d.name dept, o.post_title title from opportunities o join departments d on d.id=o.department_id
     where o.closing_date >= current_date and o.status <> 'withdrawn' order by o.closing_date desc limit 1`);
  const [other] = await sql<{ name: string }>(`select name from departments where name <> $1 limit 1`, [opp.dept]);

  // Applicant starts an application from the job page.
  const applicant = email("applicant");
  await signUp(page, "Lindiwe Test Mokoena", applicant);
  await page.goto(`/posts/${opp.id}`);
  await page.getByRole("button", { name: "Apply now →" }).click();
  await expect(page.getByRole("heading", { name: "1. Your documents" })).toBeVisible();
  await expect(page.getByLabel("Surname")).toHaveValue("Mokoena"); // pre-filled from the account

  // Sending too early explains what's missing.
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Still needed" })).toBeVisible();

  // Documents.
  for (const [label, done] of [["Upload CV", "✓ CV"], ["Upload Certified copy of your ID", "✓ Certified copy of your ID"]]) {
    await page.getByLabel(label).setInputFiles(CV);
    await page.getByLabel(label).locator("xpath=following-sibling::button").click();
    await expect(page.getByText(done)).toBeVisible();
  }

  // Form.
  await page.getByLabel("Date of birth").fill("1995-06-22");
  await page.getByLabel("South African ID number").fill("9506225123081");
  await page.getByLabel("Phone number").fill("0824447788");
  await page.getByLabel("Qualification", { exact: true }).fill("National Senior Certificate");
  for (const q of ["Have you been convicted", "Do you have a criminal, civil", "Have you been dismissed", "Do you do business with the state"]) {
    await page.getByRole("group", { name: new RegExp(q) }).getByText("No", { exact: true }).click();
  }
  await page.getByLabel(/I declare that the information/).check();
  await page.getByRole("button", { name: "Send application" }).click();
  await expect(page.getByTestId("toast")).toContainText("Application sent");
  await expect(page.getByTestId("app-status")).toHaveText("Sent");
  await page.goto("/applications");
  await expect(page.getByTestId("application").first()).toContainText("Sent");

  // The uploads were kept in My documents, with the time they were last updated...
  await page.goto("/account/documents");
  await expect(page.getByTestId("my-document")).toHaveCount(2);
  await expect(page.getByTestId("my-document").first()).toContainText("Last updated");
  // ...and a new application starts with them already attached.
  const [next] = await sql<{ id: string }>(
    `select id from opportunities where closing_date >= current_date and status <> 'withdrawn' and id <> $1 order by closing_date desc limit 1`, [opp.id]);
  await page.goto(`/posts/${next.id}`);
  await page.getByRole("button", { name: "Apply now →" }).click();
  await expect(page.getByText("✓ CV")).toBeVisible();
  await expect(page.getByText("✓ Certified copy of your ID")).toBeVisible();

  // Officer of another department can't see it.
  await page.context().clearCookies();
  const outsider = email("outsider");
  await signUp(page, "Other Dept Officer", outsider);
  await makeOfficer(outsider, other.name);
  await page.goto("/portal/applications");
  await expect(page.getByTestId("officer-application")).toHaveCount(0);

  // Officer of the right department reviews and shortlists.
  await page.context().clearCookies();
  const officer = email("hr");
  await signUp(page, "Thabo HR Officer", officer);
  await makeOfficer(officer, opp.dept);
  await page.goto("/portal/applications");
  const row = page.getByTestId("officer-application").filter({ hasText: "Lindiwe Test Mokoena" });
  await expect(row).toContainText("New");
  await row.click();
  await expect(page.getByText("•••••••••3081")).toBeVisible(); // ID masked
  const pdf = await page.request.get(await page.getByRole("link", { name: "sample-cv-fictional.pdf" }).first().getAttribute("href") as string);
  expect(pdf.status()).toBe(200);
  await page.getByLabel("Change status").selectOption("shortlisted");
  await page.getByPlaceholder("Optional note to the applicant").fill("Interviews on 3 December.");
  await page.getByRole("button", { name: "Save status" }).click();
  await expect(page.getByTestId("officer-status")).toHaveText("Shortlisted");

  // Applicant sees the new status and a message.
  await signIn(page, applicant);
  await page.goto("/applications");
  await expect(page.getByTestId("application").first()).toContainText("Shortlisted");
  await page.goto("/notifications");
  await expect(page.getByTestId("notification").first()).toContainText("Interviews on 3 December.");
});
