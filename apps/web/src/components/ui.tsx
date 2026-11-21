import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const variants = {
  primary: "bg-black text-white font-semibold hover:bg-[#222] active:translate-y-px",
  secondary: "border border-black/25 text-foreground hover:bg-black/5",
  danger: "bg-black text-white font-semibold hover:bg-[#222]",
  ghost: "text-foreground hover:bg-black/5",
};
type Variant = keyof typeof variants;

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cx(buttonBase, variants[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(buttonBase, variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-xl border border-border bg-white p-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)]", className)} {...props} />;
}

const badgeTones = {
  neutral: "bg-black/[0.04] text-muted border border-border",
  brand: "bg-brand-soft text-brand",
  warn: "bg-warn-bg text-warn-ink",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info-ink",
};
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof badgeTones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cx("block text-sm font-medium mb-1", className)} {...props} />;
}

const field =
  "w-full rounded-md border border-border bg-field text-foreground placeholder:text-muted/70 px-3 py-2 text-sm focus:outline-2 focus:outline-brand";
export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(field, className)} {...props} />;
}
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(field, className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(field, className)} {...props} />;
}

/* One type scale for every page: page title text-2xl semibold, section title text-lg semibold, body normal. */
export function PageTitle({ children, sub, eyebrow, actions }: { children: ReactNode; sub?: ReactNode; eyebrow?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-wide text-muted">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
        {sub && <p className="mt-1 text-[15px] text-muted max-w-3xl">{sub}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, id, className = "" }: { children: ReactNode; id?: string; className?: string }) {
  return <h2 id={id} className={`text-lg font-semibold ${className}`}>{children}</h2>;
}

export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 px-6 py-10 text-center text-[15px] text-muted">
      <p>{children}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "warn" | "danger" | "brand";
  children: ReactNode;
}) {
  const t = {
    info: "bg-info-soft text-info-ink border-info-ink/30",
    warn: "bg-warn-bg text-warn-ink border-warn-ink/30",
    danger: "bg-danger-soft text-danger border-danger/30",
    brand: "bg-brand-soft text-brand border-brand/30",
  }[tone];
  return <div className={cx("rounded-lg border px-4 py-3 text-sm", t)}>{children}</div>;
}

export function NotStated() {
  return <span className="italic text-muted">Not stated in the advert</span>;
}
