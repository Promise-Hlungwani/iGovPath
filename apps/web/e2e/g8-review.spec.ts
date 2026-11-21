import path from "node:path";
import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeOfficer, signIn, signUp, sql } from "./helpers";

const SOURCES = path.resolve(__dirname, "../../../data/sources");

test.afterAll(async () => {
  // Remove what this test published so the sample set stays clean.
  await sql(`delete from opportunities where source_document_id in (select id from source_documents where file_name in ('sample-advert-dws-42-282.pdf','psvc-42-2026-annexure-v-presidency.pdf'))`);
  await sql(`delete from source_documents where file_name in ('sample-advert-dws-42-282.pdf','psvc-42-2026-annexure-v-presidency.pdf')`);
  await cleanupTestUsers();
});

test("G6-G8: upload, extract, review with evidence, edit, approve, publish, audit, isolation", async ({ page }) => {
  const dws = email("dws-officer");
  const lp = email("lp-officer");
  await signUp(page, "Nomsa DWS Officer", dws);
  await makeOfficer(dws, "Department of Water and Sanitation");
  await page.context().clearCookies();
  await signUp(page, "Pieter Limpopo Officer", lp);
  await makeOfficer(lp, "Limpopo Department of Agriculture and Rural Development");

  // Upload a single advert.
  await signIn(page, dws);
  await page.goto("/portal/upload");
  await page.getByLabel("PDF file").setInputFiles(path.join(SOURCES, "sample-advert-dws-42-282.pdf"));
  await page.getByLabel("What is it?").selectOption("advert");
  await page.getByLabel("Date issued").fill("2026-11-20");
  await page.getByLabel("Title").fill("Finance Clerk advert (PSVC 42 excerpt)");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Upload and read" }).click();
  await expect(page.getByRole("heading", { name: "Review extracted record" })).toBeVisible({ timeout: 120_000 });
  const reviewUrl = page.url();

  // Evidence is highlighted in the source and shown under fields.
  expect(await page.locator("mark.evidence").count()).toBeGreaterThan(3);
  await expect(page.getByText(/Evidence: “/).first()).toBeVisible();
  await expect(page.getByLabel("Reference number")).toHaveValue(/041226/);

  // Edit one field, approve.
  await page.getByLabel("Location").fill("Midmar Dam (Howick), KwaZulu-Natal");
  await page.getByLabel(/^Note/).fill("Checked against PSVC 42 page 212");
  await page.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page.getByText("Approved and published.")).toBeVisible();

  // Appears in applicant search.
  await page.context().clearCookies();
  await page.goto("/search?q=revenue");
  await expect(page.getByRole("heading", { name: /Revenue Management/i })).toBeVisible();
  await page.getByRole("heading", { name: /Revenue Management/i }).click();
  await expect(page.getByText("Midmar Dam (Howick), KwaZulu-Natal").first()).toBeVisible();
  await expect(page.getByText(/approved by Nomsa DWS Officer/)).toBeVisible();

  // Audit log has the officer's name, department and the edit.
  const rows = await sql<{ actor_name: string; dept: string; after: { editedByOfficer: boolean; location: string } }>(
    `select a.actor_name, d.name dept, a.after from audit_log a join departments d on d.id=a.actor_department_id
     where a.action='opportunity.publish' and a.actor_name='Nomsa DWS Officer' order by a.at desc limit 1`,
  );
  expect(rows[0].dept).toBe("Department of Water and Sanitation");
  expect(rows[0].after.editedByOfficer).toBe(true);
  expect(rows[0].after.location).toBe("Midmar Dam (Howick), KwaZulu-Natal");

  // Limpopo officer cannot open DWS's review page.
  await signIn(page, lp);
  await page.goto(reviewUrl);
  await expect(page).toHaveURL(/\/portal$/);

  // Circular upload lists posts and extracts one on request (G6).
  await signIn(page, dws);
  await page.goto("/portal/upload");
  await page.getByLabel("PDF file").setInputFiles(path.join(SOURCES, "psvc-42-2026-annexure-v-presidency.pdf"));
  await page.getByLabel("What is it?").selectOption("circular");
  await page.getByLabel("Title").fill("PSVC 42 Annexure V (The Presidency)");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Upload and read" }).click();
  await expect(page.getByRole("heading", { name: "Posts in this document (1)" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("Member of the Audit Committee")).toBeVisible();
  await page.getByRole("button", { name: "Extract" }).click();
  await expect(page.getByRole("heading", { name: "Review extracted record" })).toBeVisible({ timeout: 120_000 });
});
