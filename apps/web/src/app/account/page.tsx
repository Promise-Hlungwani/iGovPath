import Link from "next/link";
import { Badge, ButtonLink, Card, Notice, PageTitle } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";
import { requireUser } from "@/lib/session";

const roleLabel = { applicant: "Applicant", officer: "Government officer", admin: "Admin" };

export default async function AccountPage() {
  const u = await requireUser("/account");
  return (
    <div className="max-w-2xl space-y-6">
      <PageTitle sub={u.email}>Hello, {u.name}</PageTitle>
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Role</span>
          <Badge tone="brand">{roleLabel[u.role]}</Badge>
          {u.status !== "active" && <Badge tone={u.status === "pending" ? "warn" : "danger"}>{u.status}</Badge>}
        </div>
        {u.departmentName && (
          <p className="text-sm">
            <span className="text-muted">Department:</span> {u.departmentName}
            {u.jobTitle && <span className="text-muted"> · {u.jobTitle}</span>}
          </p>
        )}
        {u.status === "deactivated" && <Notice tone="danger">This account has been deactivated. Contact the platform admin.</Notice>}
        {u.role === "officer" && u.status === "pending" && (
          <Notice tone="warn">Your officer access is awaiting approval by an admin. You can still use the applicant side meanwhile.</Notice>
        )}
        {u.role === "officer" && u.status === "rejected" && (
          <Notice tone="danger">
            Your officer access request was not approved.{" "}
            <Link className="underline" href="/account/request-officer-access">Request again</Link>
          </Notice>
        )}
      </Card>
      <div className="flex flex-wrap gap-3">
        {u.role === "applicant" && u.status === "active" && (
          <ButtonLink href="/account/request-officer-access" variant="secondary">I work for a government department</ButtonLink>
        )}
        {(u.role === "admin" || (u.role === "officer" && u.status === "active")) && <ButtonLink href="/portal">Officer portal</ButtonLink>}
        {u.role === "admin" && <ButtonLink href="/admin/users" variant="secondary">Manage users</ButtonLink>}
        {u.role === "applicant" && <ButtonLink href="/saved" variant="secondary">My saved posts</ButtonLink>}
        <SignOutButton />
      </div>
    </div>
  );
}
