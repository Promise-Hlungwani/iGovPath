import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeAdmin, signIn, signUp, sql } from "./helpers";

const LIMPOPO = "Limpopo Department of Agriculture and Rural Development";
const DWS = "Department of Water and Sanitation";

test.afterAll(cleanupTestUsers);

test("G3: roles, officer approval, department isolation, audit", async ({ page }) => {
  const applicant = email("applicant");
  const officer = email("officer");
  const admin = email("admin");

  // Sign-up gives an active applicant who cannot use the portal.
  await signUp(page, "Thandi Applicant", applicant);
  await expect(page.getByText("Applicant", { exact: true })).toBeVisible();
  await page.goto("/portal");
  await expect(page.getByText("The portal is for government officers")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Review queue" })).toHaveCount(0);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/$/); // redirected home

  // Officer requests access -> pending.
  await page.context().clearCookies();
  await signUp(page, "Sipho Officer", officer);
  await page.getByRole("link", { name: /Government officer\?/ }).click();
  await page.getByLabel("Department").selectOption({ label: LIMPOPO + " (Limpopo)" });
  await page.getByLabel("Job title").fill("HR Practitioner");
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(page.getByText("awaiting approval")).toBeVisible();
  await page.goto("/portal");
  await expect(page.getByText("awaiting approval")).toBeVisible();

  // Admin approves.
  await page.context().clearCookies();
  await signUp(page, "Lerato Admin", admin);
  await makeAdmin(admin);
  await page.goto("/admin/users");
  const card = page.locator("div", { hasText: "Sipho Officer" }).filter({ has: page.getByRole("button", { name: "Approve" }) }).last();
  await card.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("No pending requests.")).toBeVisible();

  // Officer can now open the portal and sees only Limpopo records.
  await signIn(page, officer);
  await page.goto("/portal/opportunities");
  await expect(page.getByRole("heading", { name: "Published records" })).toBeVisible();
  const items = page.getByTestId("portal-opp");
  expect(await items.count()).toBeGreaterThan(0);
  const text = await page.locator("main").innerText();
  expect(text).toContain(LIMPOPO);
  expect(text).not.toContain(DWS);

  // The approval is in the audit log with the admin's name and the officer's id.
  const rows = await sql<{ actor_name: string; action: string }>(
    `select actor_name, action from audit_log where entity_id=(select id from "user" where email=$1) order by at`,
    [officer],
  );
  expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["user.sign_up", "role.request_officer", "role.approve_officer"]));
  expect(rows.find((r) => r.action === "role.approve_officer")?.actor_name).toBe("Lerato Admin");
});
