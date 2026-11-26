import { NavLink } from "@/components/nav-link";
import { ButtonLink, Card, Notice } from "@/components/ui";
import { isActiveOfficer, requireUser } from "@/lib/session";
import { headerCounts } from "@/lib/queue";
import { CountBadge } from "@/components/count-badge";

const nav = [
  { href: "/portal", label: "Review queue" },
  { href: "/portal/applications", label: "Applications" },
  { href: "/portal/upload", label: "Upload" },
  { href: "/portal/opportunities", label: "Published" },
  { href: "/portal/forms", label: "Forms" },
  { href: "/portal/draft-check", label: "Draft check" },
  { href: "/portal/dashboard", label: "Dashboard" },
  { href: "/portal/audit", label: "Audit log" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser("/portal");
  if (!isActiveOfficer(u)) {
    return (
      <Card className="max-w-xl space-y-4">
        <h1 className="text-xl font-extrabold">Officer portal</h1>
        {u.role === "officer" && u.status === "pending" ? (
          <Notice tone="warn">Your officer access is <strong>awaiting approval</strong> by an admin.</Notice>
        ) : u.role === "officer" && u.status === "rejected" ? (
          <Notice tone="danger">Your officer access request was not approved.</Notice>
        ) : (
          <Notice tone="info">The portal is for government officers. If you work for a department, request access first.</Notice>
        )}
        <ButtonLink href="/account" variant="secondary">Go to my account</ButtonLink>
      </Card>
    );
  }
  // Same single query as the header (cached for this request), not two more round trips.
  const { queue, newApps } = await headerCounts().catch(() => ({ queue: 0, newApps: 0 }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <nav className="flex flex-wrap gap-1 text-sm">
          {nav.map((n) => (
            <NavLink key={n.href} href={n.href} exact={n.href === "/portal"} also={n.href === "/portal" ? ["/portal/review", "/portal/documents"] : []}>
              {n.label}
              {n.href === "/portal" && <CountBadge n={queue} />}
              {n.href === "/portal/applications" && <CountBadge n={newApps} />}
            </NavLink>
          ))}
        </nav>
        <p className="text-sm text-muted">
          Signed in as <strong className="text-foreground">{u.name}</strong> · {u.role === "admin" ? "Admin (all departments)" : u.departmentName}
        </p>
      </div>
      {children}
    </div>
  );
}
