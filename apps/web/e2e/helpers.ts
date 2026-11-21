import path from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { expect, type Page } from "@playwright/test";

config({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

export const TEST_DOMAIN = "e2e.igovpath.test";
export const PASSWORD = "Sample-Passw0rd!";
export const email = (name: string) => `${name}-${Date.now().toString(36)}@${TEST_DOMAIN}`;

export async function sql<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL!.replace("sslmode=require", "sslmode=verify-full") });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

export async function signUp(page: Page, name: string, mail: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(mail);
  await page.getByLabel("Password").fill(PASSWORD);
  const resp = page.waitForResponse((r) => r.url().includes("/api/auth/sign-up/email"), { timeout: 60_000 }).catch(() => null);
  await page.getByRole("button", { name: "Create account" }).click();
  const r = await resp;
  if (!r || r.status() !== 200) {
    throw new Error(`sign-up failed: ${r ? `${r.status()} ${(await r.text()).slice(0, 300)}` : "no response from /api/auth/sign-up/email"}`);
  }
  await expect(page).toHaveURL(/\/account/);
}

export async function signIn(page: Page, mail: string) {
  await page.context().clearCookies();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(mail);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/account/);
}

export async function makeAdmin(mail: string) {
  await sql(`update user_roles set role='admin', status='active' where user_id=(select id from "user" where email=$1)`, [mail]);
}

export async function makeOfficer(mail: string, departmentName: string) {
  await sql(
    `update user_roles set role='officer', status='active', department_id=(select id from departments where name=$2), approved_at=now()
     where user_id=(select id from "user" where email=$1)`,
    [mail, departmentName],
  );
}

/** Remove every e2e user (cascades to their sessions, roles, saved posts, notifications). */
export async function cleanupTestUsers() {
  await sql(`update audit_log set actor_user_id=null where actor_user_id in (select id from "user" where email like $1)`, [`%@${TEST_DOMAIN}`]);
  await sql(`update user_roles set approved_by=null where approved_by in (select id from "user" where email like $1)`, [`%@${TEST_DOMAIN}`]);
  await sql(`update opportunity_versions set approved_by=null where approved_by in (select id from "user" where email like $1)`, [`%@${TEST_DOMAIN}`]);
  await sql(`update extractions set reviewed_by=null where reviewed_by in (select id from "user" where email like $1)`, [`%@${TEST_DOMAIN}`]);
  await sql(`update source_documents set uploaded_by=null where uploaded_by in (select id from "user" where email like $1)`, [`%@${TEST_DOMAIN}`]);
  await sql(`delete from "user" where email like $1`, [`%@${TEST_DOMAIN}`]);
}
