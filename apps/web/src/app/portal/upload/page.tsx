import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { Card, Input, Label, Notice, PageTitle, Select } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { requireOfficer } from "@/lib/session";
import { SAMPLE_MODE } from "@/lib/flags";
import { uploadDocument } from "../actions";

// AI steps can take up to a minute.
export const maxDuration = 60;

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const u = await requireOfficer();
  const { error } = await searchParams;
  const depts = u.role === "admin" ? await db.select().from(schema.departments).orderBy(asc(schema.departments.name)) : [];
  return (
    <div className="max-w-2xl">
      <PageTitle sub="AI reads the document and prepares a record. Nothing is published until you approve it.">Upload a document</PageTitle>
      <Card>
        <form action={uploadDocument} className="space-y-4">
          <div>
            <Label htmlFor="file">PDF file</Label>
            <Input id="file" name="file" type="file" accept="application/pdf" required />
            <p className="text-xs text-muted mt-1">PDF up to 4 MB. For a whole vacancy circular, upload only your department&apos;s annexure pages.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="kind">What is it?</Label>
              <Select id="kind" name="kind" defaultValue="advert">
                <option value="advert">A single advert</option>
                <option value="circular">A vacancy circular or annexure (many posts)</option>
                <option value="amendment">An amendment notice</option>
                <option value="form">A form (new version)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="documentDate">Date issued</Label>
              <Input id="documentDate" name="documentDate" type="date" />
            </div>
          </div>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" required minLength={3} placeholder="e.g. Public Service Vacancy Circular 42 of 2026" />
          </div>
          {u.role === "admin" ? (
            <div>
              <Label htmlFor="departmentId">Department</Label>
              <Select id="departmentId" name="departmentId" required>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
          ) : (
            <p className="text-sm text-muted">Department: <strong className="text-foreground">{u.departmentName}</strong></p>
          )}
          {SAMPLE_MODE && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirmPublic" required className="mt-1" />
              <span>This is a <strong>public</strong> document. It contains no applicant personal information.</span>
            </label>
          )}
          {error && <Notice tone="danger">{error}</Notice>}
          <SubmitButton pendingText="Reading the document… (up to a minute)">Upload and read</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
