"use client";

import clsx from "clsx";
import Link from "next/link";
import { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant =
  | "primary"
  | "secondary"
  | "outline"
  | "success"
  | "danger"
  | "dangerOutline"
  | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-sm hover:bg-brand-hover active:brightness-95 focus-visible:shadow-focus disabled:opacity-50",
  secondary:
    "bg-stone-900 text-white hover:bg-stone-800 focus-visible:shadow-focus dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white disabled:opacity-50",
  outline:
    "border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--chip-bg-hover)] focus-visible:shadow-focus disabled:opacity-50",
  success:
    "border border-success/45 bg-success/12 text-success hover:border-success/55 hover:bg-success/20 focus-visible:shadow-focus disabled:opacity-50",
  danger:
    "bg-danger text-white hover:brightness-110 focus-visible:shadow-focus disabled:opacity-50",
  dangerOutline:
    "border border-danger/40 bg-transparent text-danger hover:border-danger/55 hover:bg-danger/10 focus-visible:shadow-focus disabled:opacity-50",
  ghost:
    "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] focus-visible:shadow-focus disabled:opacity-50",
};

const SIZE: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  /** Shows a circular spinner and disables the button. */
  loading?: boolean;
  className?: string;
  children?: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined };

/** With `href` the button renders as a Next.js link styled like the button (no nested interactive content). */
type ButtonAsLink = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof CommonProps | "href"> & {
    href: string;
    disabled?: boolean;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150 focus-visible:outline-none";

export default function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className, children, loading = false, ...rest } = props;
  const classes = clsx(BASE, VARIANT[variant], SIZE[size], className);
  const content = (
    <>
      {loading && (
        <span
          className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </>
  );

  if (typeof props.href === "string") {
    const { href, disabled, onClick, ...anchorRest } = rest as Omit<ButtonAsLink, keyof CommonProps>;
    const inactive = Boolean(disabled || loading);
    return (
      <Link
        {...anchorRest}
        href={href}
        className={clsx(classes, inactive && "pointer-events-none opacity-50")}
        aria-disabled={inactive || undefined}
        aria-busy={loading || undefined}
        tabIndex={inactive ? -1 : anchorRest.tabIndex}
        onClick={(e) => {
          if (inactive) {
            e.preventDefault();
            return;
          }
          onClick?.(e);
        }}
      >
        {content}
      </Link>
    );
  }

  const { disabled, ...buttonRest } = rest as Omit<ButtonAsButton, keyof CommonProps>;
  return (
    <button
      className={classes}
      {...buttonRest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {content}
    </button>
  );
}
