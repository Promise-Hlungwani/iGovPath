import path from "node:path";
import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeOfficer, signIn, signUp, sql } from "./helpers";

const SOURCES = path.resolve(__dirname, "../../../data/sources");
const EC_DSD = "Eastern Cape Department of Social Development";

/** Put the two amended sample posts back to version 1 so the demo can be replayed. */
export async function restoreAmendedPosts() {
  const opps = await sql<{ id: string }>(`select id from opportunities where reference_number in ('DSD 02/11/2026','GPW 26/012')`);
  for (const { id } of opps) {
    await sql(
      `update opportunities o set
         minimum_requirements = v.record->'minimumRequirements',
         closing_date = (v.record->>'closingDate')::date,
         apply_route = v.record->'applyRoute',
         status = 'open', current_version = 1
       from opportunity_versions v where v.opportunity_id = o.id and v.version = 1 and o.id = $1`,
      [id],
    );
    await sql(`delete from opportunity_versions where opportunity_id=$1 and version > 1`, [id]);
    await sql(`delete from generated_checklists where opportunity_id=$1 and version > 1`, [id]);
    await sql(`delete from generated_explanations where opportunity_id=$1 and version > 1`, [id]);
  }
  await sql(`delete from source_documents where file_name='psvc-42-2026-amendments.pdf'`);
}

test.beforeAll(restoreAmendedPosts);
test.afterAll(async () => {
  await restoreAmendedPosts();
  await cleanupTestUsers();
});

test("G14 + G12: amendment flows end to end and notifies the applicant", async ({ page }) => {
  const [dsd] = await sql<{ id: string }>(`select id from opportunities where reference_number='DSD 02/11/2026'`);
  const applicant = email("saver");
  const officer = email("ecdsd-officer");

  // Applicant saves the post first.
  await signUp(page, "Zola Applicant", applicant);
  await page.goto(`/posts/${dsd.id}`);
  await expect(page.getByText("Law, Labour Relations").first()).toBeVisible();
  await page.getByRole("button", { name: "Save and get reminders" }).click();
  await expect(page.getByRole("button", { name: /Saved/ })).toBeVisible();

  // EC DSD officer uploads the amendment notice.
  await page.context().clearCookies();
  await signUp(page, "Bongani EC DSD Officer", officer);
  await makeOfficer(officer, EC_DSD);
  await page.goto("/portal/upload");
  await page.getByLabel("PDF file").setInputFiles(path.join(SOURCES, "psvc-42-2026-amendments.pdf"));
  await page.getByLabel("What is it?").selectOption("amendment");
  await page.getByLabel("Date issued").fill("2026-11-20");
  await page.getByLabel("Title").fill("PSVC 42 of 2026: amendments");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Upload and read" }).click();
  await expect(page.getByRole("heading", { name: /Amendments found/ })).toBeVisible({ timeout: 120_000 });

  // Review the DSD amendment: before/after diff with evidence, then confirm.
  await page.getByTestId("amendment-DSD 02/11/2026").getByRole("link", { name: "Review" }).click();
  await expect(page.getByText("Matched to the published post")).toBeVisible();
  await expect(page.getByText("Before:").first()).toBeVisible();
  await expect(page.getByText(/Labour Law, Industrial Relations/).first()).toBeVisible();
  await page.getByRole("button", { name: "Confirm and apply amendment" }).click();
  await expect(page.getByText("Approved and published.")).toBeVisible();

  // The GPW amendment belongs to another department: this officer is refused.
  const [gpwExt] = await sql<{ id: string }>(
    `select e.id from extractions e join source_documents d on d.id=e.source_document_id
     where d.file_name='psvc-42-2026-amendments.pdf' and e.record->>'reference_number' ilike 'GPW%012' limit 1`,
  );
  await page.goto(`/portal/review/${gpwExt.id}`);
  await expect(page).toHaveURL(/\/portal$/);

  // Applicant sees the notification, the Amended badge and the diff.
  await signIn(page, applicant);
  await expect(page.getByTestId("unread")).toHaveText("1");
  await page.goto("/notifications");
  await expect(page.getByTestId("notification").first()).toContainText("was amended: requirements changed");
  await page.getByRole("link", { name: "Open the post" }).first().click();
  await expect(page.getByText("Amended", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/This post was amended/)).toBeVisible();
  await expect(page.getByText("Version 2")).toBeVisible();
  await expect(page.getByText(/approved by Bongani EC DSD Officer/)).toBeVisible();
  await expect(page.getByText(/Labour Law, Industrial Relations/).first()).toBeVisible();
  await expect(page.getByText("Before:").first()).toBeVisible();

  // Checklist is rebuilt for the new version.
  await page.goto(`/posts/${dsd.id}/checklist`);
  await expect(page.getByText("standard rule").first()).toBeVisible({ timeout: 60_000 });
});
