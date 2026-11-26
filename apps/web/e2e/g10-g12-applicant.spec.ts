import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, signIn, signUp, sql } from "./helpers";

let restore: { id: string; closing: string } | null = null;

test.afterAll(async () => {
  if (restore) await sql(`update opportunities set closing_date=$2 where id=$1`, [restore.id, restore.closing]);
  await cleanupTestUsers();
});

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("G10 + G12: checklist ticks persist; saving a post closing in 2 days shows a reminder", async ({ page }) => {
  const [opp] = await sql<{ id: string; closing_date: string }>(
    `select id, to_char(closing_date,'YYYY-MM-DD') closing_date from opportunities where post_title ilike 'SWITCHBOARD%' limit 1`,
  );
  restore = { id: opp.id, closing: opp.closing_date };
  const in2 = new Date();
  in2.setDate(in2.getDate() + 2);
  await sql(`update opportunities set closing_date=$2 where id=$1`, [opp.id, iso(in2)]);

  const a = email("ticker");
  await signUp(page, "Ayanda Applicant", a);

  // Save the post.
  await page.goto(`/posts/${opp.id}`);
  await page.getByRole("button", { name: "Save and get reminders" }).click();
  await expect(page.getByRole("button", { name: /Saved/ })).toBeVisible();

  // Reminder appears (closing in 2 days).
  await page.goto("/saved");
  await expect(page.getByTestId("saved-item")).toHaveCount(1);
  await expect(page.getByText("(2 days left)")).toBeVisible();
  await expect(page.getByTestId("unread")).toHaveText("1");
  await page.getByText("View application timeline").click();
  await expect(page.getByText("Application timeline").last()).toBeVisible();
  await expect(page.getByText("Application closes").last()).toBeVisible();
  await expect(page.getByRole("link", { name: "Download calendar reminder" }).last()).toBeVisible();
  await page.goto("/notifications");
  await expect(page.getByTestId("notification").first()).toContainText("closes on");
  await expect(page.getByTestId("notification").first()).toContainText("Closing soon");

  // Checklist: standard items present; tick two.
  await page.goto(`/posts/${opp.id}/checklist`);
  await expect(page.getByText("standard rule").first()).toBeVisible();
  for (const name of [/Z83/, /Your CV/]) {
    const box = page.getByRole("checkbox", { name });
    await box.check();
    await expect(box).toBeChecked();
  }
  await expect(page.getByText(/2 of \d+ done/)).toBeVisible();
  // Wait until both ticks are stored before signing out.
  await expect
    .poll(async () => {
      const [r] = await sql<{ n: number }>(
        `select count(*)::int n from saved_opportunities s, jsonb_each(s.checklist_state) e
         where s.user_id=(select id from "user" where email=$1) and e.value='true'::jsonb`, [a]);
      return r?.n ?? 0;
    }, { timeout: 20_000 })
    .toBe(2);

  // Sign out and back in: ticks persist.
  await signIn(page, a);
  await page.goto(`/posts/${opp.id}/checklist`);
  await expect(page.getByRole("checkbox", { name: /Z83/ })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: /Your CV/ })).toBeChecked();
  await expect(page.getByText(/2 of \d+ done/)).toBeVisible();
});
