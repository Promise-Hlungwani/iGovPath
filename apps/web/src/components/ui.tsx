import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const variants = {
  primary: "bg-brand text-brand-ink font-semibold shadow-[0_4px_0_#3a8f71] hover:brightness-105 active:translate-y-px active:shadow-[0_2px_0_#3a8f71]",
  secondary: "border border-white/25 text-foreground hover:bg-white/5",
  danger: "bg-danger text-[#2b0b08] font-semibold hover:brightness-105",
  ghost: "text-foreground hover:bg-white/5",
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
  return <div className={cx("rounded-xl border border-border bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5", className)} {...props} />;
}

const badgeTones = {
  neutral: "bg-white/5 text-muted border border-border",
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

export function PageTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
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
