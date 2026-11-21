import path from "node:path";
import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeOfficer, signIn, signUp, sql } from "./helpers";

const SOURCES = path.resolve(__dirname, "../../../data/sources");
const LP = "Limpopo Department of Agriculture and Rural Development";

async function restoreForms() {
  await sql(`update forms set status='current', superseded_by_id=null where code='LDARD-SAF' and version='1'`);
  await sql(`delete from forms where code='LDARD-SAF' and version<>'1'`);
  await sql(`delete from forms where code='Z83' and is_central=false`);
  await sql(`delete from source_documents where file_name='sample-form-ldard-saf-v2.pdf'`);
}
test.beforeAll(restoreForms);
test.afterAll(async () => {
  await restoreForms();
  await cleanupTestUsers();
});

test("G16: new form version archives the old one and warns applicants; Z83 cannot be edited", async ({ page }) => {
  const [opp] = await sql<{ id: string }>(`select id from opportunities where post_title ilike 'ADMINISTRATIVE CLERK STORES%'`);
  const applicant = email("form-saver");
  const officer = email("lp-forms");
  await signUp(page, "Kagiso Applicant", applicant);
  await page.goto(`/posts/${opp.id}`);
  await page.getByRole("button", { name: "Save and get reminders" }).click();
  await expect(page.getByRole("button", { name: /Saved/ })).toBeVisible();

  await page.context().clearCookies();
  await signUp(page, "Mpho Limpopo Officer", officer);
  await makeOfficer(officer, LP);

  // Z83 is read-only in the library.
  await page.goto("/portal/forms");
  await expect(page.getByTestId("form-Z83-Effective 1 January 2021")).toContainText("Read-only");

  // Upload version 2 of the department's own form; AI pre-fills the details.
  await page.goto("/portal/upload");
  await page.getByLabel("PDF file").setInputFiles(path.join(SOURCES, "sample-form-ldard-saf-v2.pdf"));
  await page.getByLabel("What is it?").selectOption("form");
  await page.getByLabel("Title").fill("LDARD Supplementary Application Form v2 (fictional sample)");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Upload and read" }).click();
  await expect(page.getByLabel("Form code")).toHaveValue("LDARD-SAF", { timeout: 120_000 });
  await expect(page.getByLabel("Version")).toHaveValue("2");

  // Trying to publish it as Z83 is refused.
  await page.getByLabel("Form code").fill("Z83");
  await page.getByRole("button", { name: "Approve and publish this version" }).click();
  await expect(page.getByText("prescribed centrally")).toBeVisible();

  await page.getByLabel("Form code").fill("LDARD-SAF");
  await page.getByRole("button", { name: "Approve and publish this version" }).click();
  await expect(page.getByText("New version published.")).toBeVisible();
  await expect(page.getByTestId("form-LDARD-SAF-1")).toContainText("Archived");
  await expect(page.getByTestId("form-LDARD-SAF-2")).toContainText("Current");

  // The applicant is warned.
  await signIn(page, applicant);
  await page.goto("/notifications");
  await expect(page.getByTestId("notification").first()).toContainText("version 2 replaces version 1");
});
