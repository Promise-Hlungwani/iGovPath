import { expect, test, type Page } from "@playwright/test";
import { cleanupTestUsers, email, makeAdmin, makeOfficer, signUp, sql } from "./helpers";

test.afterAll(cleanupTestUsers);

function watch(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return problems;
}

async function visit(page: Page, url: string) {
  const res = await page.goto(url);
  expect(res?.status(), url).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
}

test("G20 smoke: every page loads with no console or server errors", async ({ page }) => {
  const problems = watch(page);
  const [opp] = await sql<{ id: string }>(`select id from opportunities where reference_number='DSD 02/11/2026'`);

  for (const url of ["/", "/search", "/search?q=clerk&province=Limpopo", `/posts/${opp.id}`, `/posts/${opp.id}/checklist`,
    `/posts/${opp.id}/explain`, `/posts/${opp.id}/explain?lang=isiZulu`, "/match",
    "/assistant", "/accuracy", "/sign-in", "/sign-up"]) {
    await visit(page, url);
  }

  const applicant = email("smoke-app");
  await signUp(page, "Smoke Applicant", applicant);
  for (const url of ["/account", "/saved", "/notifications", "/match", "/account/request-officer-access"]) await visit(page, url);

  await page.context().clearCookies();
  const officer = email("smoke-off");
  await signUp(page, "Smoke Officer", officer);
  await makeOfficer(officer, "Eastern Cape Department of Social Development");
  for (const url of ["/portal", "/portal/upload", "/portal/opportunities", "/portal/forms", "/portal/dashboard", "/portal/audit", "/portal/draft-check"]) {
    await visit(page, url);
  }

  await page.context().clearCookies();
  const admin = email("smoke-admin");
  await signUp(page, "Smoke Admin", admin);
  await makeAdmin(admin);
  for (const url of ["/admin/users", "/portal", "/portal/audit"]) await visit(page, url);

  expect(problems, problems.join("\n")).toEqual([]);
});
