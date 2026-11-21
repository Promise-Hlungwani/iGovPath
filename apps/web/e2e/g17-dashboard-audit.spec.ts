import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeAdmin, makeOfficer, signIn, signUp, sql } from "./helpers";

const LP = "Limpopo Department of Agriculture and Rural Development";
let dupId: string | null = null;

test.afterAll(async () => {
  if (dupId) await sql(`delete from opportunities where id=$1`, [dupId]);
  await cleanupTestUsers();
});

test("G17: anonymous dashboard counts, conflict flag, audit log for admin and officers", async ({ page, browser }) => {
  const [opp] = await sql<{ id: string; department_id: number }>(`select id, department_id from opportunities where post_title ilike 'SWITCHBOARD%'`);
  const applicant = email("dash-applicant");
  const officer = email("dash-officer");
  const admin = email("dash-admin");

  // An anonymous visit and an applicant who views + starts the checklist.
  const anon = await browser.newContext();
  await (await anon.newPage()).goto(`/posts/${opp.id}`);
  await anon.close();
  await signUp(page, "Unique Applicant Name Xq", applicant);
  await page.goto(`/posts/${opp.id}`);
  await page.goto(`/posts/${opp.id}/checklist`);
  await page.getByRole("checkbox", { name: /Your CV/ }).check();
  await expect
    .poll(async () => (await sql<{ n: number }>(`select count(*)::int n from funnel_events where opportunity_id=$1 and step='checklist_started'`, [opp.id]))[0].n)
    .toBeGreaterThan(0);

  // A conflicting record: same reference, different closing date.
  const [dup] = await sql<{ id: string }>(
    `insert into opportunities (type, department_id, post_title, reference_number, closing_date, is_sample)
     select type, department_id, post_title || ' (duplicate test)', reference_number, closing_date + 7, true from opportunities where id=$1 returning id`,
    [opp.id],
  );
  dupId = dup.id;

  // Officer dashboard: counts, conflict, no personal data.
  await page.context().clearCookies();
  await signUp(page, "Dash Officer", officer);
  await makeOfficer(officer, LP);
  await page.goto("/portal/dashboard");
  const table = page.getByTestId("funnel");
  await expect(table).toContainText("Switchboard Operator");
  await expect(page.getByText(/Conflicting records:/)).toBeVisible();
  const text = await page.locator("main").innerText();
  expect(text).not.toContain("Unique Applicant Name Xq");
  expect(text).not.toContain(applicant);
  expect(text).not.toMatch(/@/);
  const row = table.locator("tr", { hasText: "Switchboard Operator" }).first();
  const cells = await row.locator("td").allInnerTexts();
  expect(Number(cells[1])).toBeGreaterThanOrEqual(2); // viewed by at least 2 distinct visitors
  expect(Number(cells[3])).toBeGreaterThanOrEqual(1); // checklist started

  // Officer audit log hides applicant activity.
  await page.goto("/portal/audit");
  const officerAudit = await page.getByTestId("audit").innerText();
  expect(officerAudit).not.toContain("Unique Applicant Name Xq");

  // Admin sees approvals and role changes.
  await page.context().clearCookies();
  await signUp(page, "Dash Admin", admin);
  await makeAdmin(admin);
  await page.goto("/portal/audit?q=role.");
  await expect(page.getByTestId("audit")).toContainText("role.");
  await page.goto("/portal/audit?q=opportunity.publish");
  await expect(page.getByTestId("audit")).toContainText("opportunity.publish");
  await page.goto("/portal/audit?q=demo.reset");
  await expect(page.getByTestId("audit")).toContainText("reset script");
  await signIn(page, admin);
});
