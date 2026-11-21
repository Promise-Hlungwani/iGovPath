/* One command for a clean demo: reset content, re-seed, and create the demo accounts.
 * Accounts come from optional .env values (never committed):
 *   DEMO_PASSWORD, DEMO_OFFICER_NAME, DEMO_OFFICER_EMAIL, DEMO_APPLICANT_NAME, DEMO_APPLICANT_EMAIL
 * The officer belongs to the Eastern Cape Department of Social Development (the amendment story).
 * Run: pnpm demo:reset */
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "./index";
import { resetContent } from "./reset";
import { auth } from "@/lib/auth";

const OFFICER_DEPT = "Eastern Cape Department of Social Development";

async function ensureUser(name: string, email: string, password: string) {
  const [existing] = await db.select().from(schema.user).where(eq(schema.user.email, email.toLowerCase()));
  if (existing) return existing.id;
  const r = await auth.api.signUpEmail({ body: { name, email, password } });
  return r.user.id;
}

async function main() {
  const r = await resetContent();
  console.log(`Content reset: ${r.departments} departments, ${r.opportunities} opportunities.`);
  const pw = process.env.DEMO_PASSWORD;
  const off = { name: process.env.DEMO_OFFICER_NAME, email: process.env.DEMO_OFFICER_EMAIL };
  const app = { name: process.env.DEMO_APPLICANT_NAME, email: process.env.DEMO_APPLICANT_EMAIL };
  if (!pw || !off.name || !off.email || !app.name || !app.email) {
    console.log("Demo accounts skipped: set DEMO_PASSWORD, DEMO_OFFICER_NAME/EMAIL and DEMO_APPLICANT_NAME/EMAIL in .env (see .env.example).");
    process.exit(0);
  }
  const [dept] = await db.select().from(schema.departments).where(eq(schema.departments.name, OFFICER_DEPT));
  const officerId = await ensureUser(off.name, off.email, pw);
  await db
    .update(schema.userRoles)
    .set({ role: "officer", status: "active", departmentId: dept.id, jobTitle: "HR Practitioner (demo)", approvedAt: new Date() })
    .where(eq(schema.userRoles.userId, officerId));
  const applicantId = await ensureUser(app.name, app.email, pw);
  await db.update(schema.userRoles).set({ role: "applicant", status: "active", departmentId: null }).where(eq(schema.userRoles.userId, applicantId));

  // The applicant has saved the two posts that the amendment notice will change.
  const posts = await db
    .select({ id: schema.opportunities.id })
    .from(schema.opportunities)
    .where(inArray(schema.opportunities.referenceNumber, ["DSD 02/11/2026", "GPW 26/012"]));
  for (const p of posts) {
    await db.insert(schema.savedOpportunities).values({ userId: applicantId, opportunityId: p.id }).onConflictDoNothing();
  }
  await db.delete(schema.notifications).where(and(eq(schema.notifications.userId, applicantId)));
  console.log(`Demo accounts ready: officer ${off.email} (${OFFICER_DEPT}), applicant ${app.email} with ${posts.length} saved posts.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
