/* Reset content to a clean demo state, then re-seed.
 * Keeps user accounts, roles, departments and the audit log (history is never deleted).
 * Run: pnpm db:reset */
import { sql } from "drizzle-orm";
import { db, schema } from "./index";
import { seed } from "./seed";

async function main() {
  await db.execute(sql`
    truncate table notifications, saved_opportunities, funnel_events, generated_checklists, generated_explanations,
      opportunity_versions, opportunities, extractions, forms, source_documents, applicant_profiles
    restart identity cascade
  `);
  await db.insert(schema.auditLog).values({ actorName: "reset script", action: "demo.reset", entity: "database", entityId: "content" });
  const r = await seed();
  console.log(`Reset done: ${r.departments} departments, ${r.opportunities} opportunities.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
