/* Reset content to a clean demo state, then re-seed.
 * Keeps user accounts, roles, departments and the audit log (history is never deleted).
 * Run: pnpm db:reset */
import { sql } from "drizzle-orm";
import { db, schema } from "./index";
import { seed } from "./seed";

export async function resetContent() {
  await db.execute(sql`
    truncate table notifications, saved_opportunities, funnel_events, generated_checklists, generated_explanations,
      opportunity_versions, opportunities, extractions, forms, source_documents, applicant_profiles
    restart identity cascade
  `);
  await db.insert(schema.auditLog).values({ actorName: "reset script", action: "demo.reset", entity: "database", entityId: "content" });
  return seed();
}

if (process.argv[1]?.endsWith("reset.ts")) {
  resetContent()
    .then((r) => {
      console.log(`Reset done: ${r.departments} departments, ${r.opportunities} opportunities.`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
