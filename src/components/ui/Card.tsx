import clsx from "clsx";

export default function Card({
  children,
  className,
  padded = true,
  padding = "md",
}: {
  children: React.ReactNode;
  className?: string;
  /** @deprecated use `padding="none"` */
  padded?: boolean;
  /** Inner padding: "md" (default, p-5), "sm" (p-4) or "none". */
  padding?: "none" | "sm" | "md";
}) {
  const pad = padded ? padding : "none";
  return (
    <div
      className={clsx(
        "rounded-xl bg-[var(--card)] shadow-soft",
        pad === "md" && "p-5",
        pad === "sm" && "p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="section-title">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
