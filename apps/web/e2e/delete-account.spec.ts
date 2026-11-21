import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeOfficer, PASSWORD, signUp, sql } from "./helpers";

test.afterAll(cleanupTestUsers);

async function leftovers(userId: string, mail: string) {
  const [r] = await sql<Record<string, number>>(
    `select
      (select count(*)::int from "user" where id=$1 or email=$2) as users,
      (select count(*)::int from session where user_id=$1) as sessions,
      (select count(*)::int from account where user_id=$1) as logins,
      (select count(*)::int from user_roles where user_id=$1) as roles,
      (select count(*)::int from applicant_profiles where user_id=$1) as profiles,
      (select count(*)::int from saved_opportunities where user_id=$1) as saved,
      (select count(*)::int from notifications where user_id=$1) as notifications,
      (select count(*)::int from audit_log where actor_user_id=$1 or entity_id=$1 or actor_name=$3) as audit`,
    [userId, mail, "Delete Me Applicant"],
  );
  return r;
}

test("an applicant can delete their account and everything linked to it", async ({ page }) => {
  const mail = email("delete-me");
  await signUp(page, "Delete Me Applicant", mail);
  const [{ id }] = await sql<{ id: string }>(`select id from "user" where email=$1`, [mail]);
  const [opp] = await sql<{ id: string }>(`select id from opportunities where post_title ilike 'SWITCHBOARD%'`);

  // Create data: save a post, tick a checklist item, a profile, an officer request.
  await page.goto(`/posts/${opp.id}`);
  await page.getByRole("button", { name: "Save and get reminders" }).click();
  await expect(page.getByRole("button", { name: /Saved/ })).toBeVisible();
  await page.goto(`/posts/${opp.id}/checklist`);
  await page.getByRole("checkbox", { name: /Your CV/ }).check();
  await sql(`insert into applicant_profiles (user_id, cv_profile, is_sample) values ($1, '{"summary":"test"}', false)`, [id]);
  await sql(`insert into notifications (user_id, opportunity_id, kind, message, dedupe_key) values ($1,$2,'amended','test','t1')`, [id, opp.id]);
  const before = await leftovers(id, mail);
  expect(before.saved + before.profiles + before.notifications + before.audit).toBeGreaterThan(3);

  // Delete.
  await page.goto("/account");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Delete account" }).click();
  await expect(page.getByRole("dialog", { name: "Delete your account?" })).toBeVisible();
  const btn = page.getByRole("button", { name: "Delete my account permanently" });
  await expect(btn).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await btn.click();
  await expect(page.getByTestId("toast")).toContainText("Your account and all your data have been deleted.");
  await expect(page).toHaveURL(/localhost:3000\/$/);

  // Nothing left, and signed out.
  expect(await leftovers(id, mail)).toEqual({ users: 0, sessions: 0, logins: 0, roles: 0, profiles: 0, saved: 0, notifications: 0, audit: 0 });
  await page.goto("/account");
  await expect(page).toHaveURL(/sign-in/);
  await page.getByLabel("Email").fill(mail);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid|not found|incorrect/i)).toBeVisible();
});

test("a deleted officer's approved records stay published without their name", async ({ page }) => {
  const mail = email("delete-officer");
  await signUp(page, "Delete Me Officer", mail);
  await makeOfficer(mail, "Department of Water and Sanitation");
  const [{ id }] = await sql<{ id: string }>(`select id from "user" where email=$1`, [mail]);
  const [v] = await sql<{ id: number; opportunity_id: string }>(`select id, opportunity_id from opportunity_versions order by id limit 1`);
  await sql(`update opportunity_versions set approved_by=$1 where id=$2`, [id, v.id]);
  await sql(`insert into audit_log (actor_user_id, actor_name, action, entity, entity_id) values ($1,'Delete Me Officer','opportunity.publish','opportunity',$2)`, [id, v.opportunity_id]);

  await page.goto("/account");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Delete account" }).click();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page.getByRole("button", { name: "Delete my account permanently" }).click();
  await expect(page.getByTestId("toast")).toContainText("Your account and all your data have been deleted.");
  await expect(page).toHaveURL(/localhost:3000\/$/);

  const [after] = await sql<{ approved_by: string | null; opp: number; named: number; anon: number }>(
    `select (select approved_by from opportunity_versions where id=$1) approved_by,
            (select count(*)::int from opportunities where id=$2) opp,
            (select count(*)::int from audit_log where actor_name='Delete Me Officer') named,
            (select count(*)::int from audit_log where actor_name='Deleted user' and action='opportunity.publish' and entity_id=$2::text) anon`,
    [v.id, v.opportunity_id],
  );
  expect(after).toEqual({ approved_by: null, opp: 1, named: 0, anon: 1 });
  await sql(`delete from audit_log where actor_name='Deleted user' and action='opportunity.publish' and entity_id=$1`, [v.opportunity_id]);
});


test("sign out asks for confirmation in a dialog", async ({ page }) => {
  await signUp(page, "Signout Tester", email("signout"));
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  const dlg = page.getByRole("dialog", { name: "Sign out of iGovPath?" });
  await expect(dlg).toBeVisible();
  await dlg.getByRole("button", { name: "Cancel" }).click();
  await expect(dlg).toBeHidden();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
