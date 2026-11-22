import { expect, test } from "@playwright/test";
import { cleanupTestUsers, email, makeOfficer, signUp, sql } from "./helpers";

const DEPT = "Department of Home Affairs";
const TAG = `approve-all-test-${Date.now()}`;

async function cleanup() {
  await sql(`delete from opportunities where source_document_id in (select id from source_documents where title like 'approve-all-test-%')`);
  await sql(`delete from source_documents where title like 'approve-all-test-%'`);
}

test.beforeAll(async () => {
  await cleanup();
  const [doc] = await sql<{ id: string }>(
    `insert into source_documents (department_id, kind, title, file_name, file_path, sha256, is_sample)
     values ((select id from departments where name=$1), 'advert', $2, 'test.pdf', 'db:test', $3, true) returning id`,
    [DEPT, TAG, TAG],
  );
  const rec = (title: string) => JSON.stringify({
    post_title: title, reference_number: "TEST 1/2026", closing_date: "2099-12-31", salary: null, location: "Pretoria",
    minimum_requirements: ["Grade 12"], documents_required: ["CV"], form_required: "Z83",
    apply_route: { email: "test@example.com", portal_url: null, postal: null, hand_delivery: null },
    contact: { name: null, phone: null }, conditional_items: [], province: "National", opportunity_type: "post", evidence: {},
  });
  await sql(
    `insert into extractions (source_document_id, chunk_ref, chunk_text, mode, record, flags, status, department_id)
     values ($1,'a','text','new',$2::jsonb,'[]'::jsonb,'draft',(select id from departments where name=$4)),
            ($1,'b','text','new',$3::jsonb,'[{"field":"closing_date","level":"error","message":"x"}]'::jsonb,'needs_fix',(select id from departments where name=$4))`,
    [doc.id, rec("Approve All Clean Test Post"), rec("Approve All Flagged Test Post"), DEPT],
  );
});

test.afterAll(async () => {
  await cleanup();
  await cleanupTestUsers();
});

test("Approve all publishes only clean drafts, after a confirmation", async ({ page }) => {
  const o = email("approve-all");
  await signUp(page, "Bulk Officer", o);
  await makeOfficer(o, DEPT);
  await page.goto("/portal");
  await page.getByRole("button", { name: /Approve all \(1\)/ }).click();
  const dlg = page.getByRole("dialog", { name: "Approve 1 record?" });
  await expect(dlg).toContainText("1 record is not included");
  await dlg.getByRole("button", { name: "Approve all" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Approved 1 record." })).toBeVisible();

  const rows = await sql<{ title: string; status: string; published: boolean }>(
    `select e.record->>'post_title' title, e.status, (e.target_opportunity_id is not null) published
     from extractions e join source_documents d on d.id=e.source_document_id where d.title=$1 order by e.chunk_ref`, [TAG]);
  expect(rows).toEqual([
    { title: "Approve All Clean Test Post", status: "approved", published: true },
    { title: "Approve All Flagged Test Post", status: "needs_fix", published: false },
  ]);
  const [audit] = await sql<{ actor_name: string }>(`select actor_name from audit_log where action='opportunity.publish' and after->>'postTitle'='Approve All Clean Test Post' order by at desc limit 1`);
  expect(audit.actor_name).toBe("Bulk Officer");
});
