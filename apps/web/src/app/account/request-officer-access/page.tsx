import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { Button, Card, Input, Label, Notice, PageTitle, Select } from "@/components/ui";
import { requireUser } from "@/lib/session";
import { requestOfficerAccess } from "../actions";

export default async function RequestOfficerAccess({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireUser("/account/request-officer-access");
  const { error } = await searchParams;
  const depts = await db.select().from(schema.departments).orderBy(asc(schema.departments.name));
  return (
    <div className="max-w-xl">
      <PageTitle sub="Have an officer code? Enter it and you can start straight away. No code? An admin will check your request.">Request officer access</PageTitle>
      <Card>
        <form action={requestOfficerAccess} className="space-y-4">
          <div>
            <Label htmlFor="departmentId">Department</Label>
            <Select id="departmentId" name="departmentId" required defaultValue="">
              <option value="" disabled>Choose your department</option>
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.province ? ` (${d.province})` : ""}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="jobTitle">Job title</Label>
            <Input id="jobTitle" name="jobTitle" required minLength={2} placeholder="e.g. HR Practitioner" />
          </div>
          <div>
            <Label htmlFor="officerCode">Officer code (if you have one)</Label>
            <Input id="officerCode" name="officerCode" inputMode="numeric" autoComplete="off" placeholder="e.g. 12345" className="max-w-xs" />
            <p className="text-xs text-muted mt-1">Leave it empty to wait for an admin to approve you.</p>
          </div>
          {error === "1" && <Notice tone="danger">Please choose a department and enter your job title.</Notice>}
          {error === "code" && <Notice tone="danger">Incorrect code.</Notice>}
          {error === "locked" && <Notice tone="danger">Too many wrong codes. Please wait an hour, or leave the code empty to wait for an admin.</Notice>}
          <Button type="submit">Send request</Button>
        </form>
      </Card>
    </div>
  );
}
