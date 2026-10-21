"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { BadgeCheck, CircleAlert, FlaskConical, Info, Radio, TriangleAlert } from "lucide-react";
import type { DataKind, FeedStatus, QualityLevel } from "@/lib/domain/types";
import { useApp } from "@/lib/store/AppProvider";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "dark" | "danger";
const BTN: Record<Variant, string> = {
  primary: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-[0_6px_18px_-8px_rgb(14_134_85/0.7)]",
  secondary: "bg-paper text-ink border border-line-strong hover:border-forest-600 hover:bg-white",
  ghost: "text-ink-soft hover:bg-sand",
  dark: "bg-forest-900 text-white hover:bg-forest-800",
  danger: "bg-paper text-rust-700 border border-rust-100 hover:bg-rust-50",
};
const SIZE = { sm: "min-h-9 px-3 text-sm rounded-xl", md: "min-h-11 px-4 text-[15px] rounded-2xl", lg: "min-h-13 px-6 text-base rounded-2xl" };

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZE }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-bold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        BTN[variant],
        SIZE[size],
        className,
      )}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof SIZE }) {
  return (
    <Link
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 font-bold transition-all duration-150 active:scale-[0.98]",
        BTN[variant],
        SIZE[size],
        className,
      )}
    />
  );
}

export function Card({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div {...props} className={cx("card", className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, sub, action, icon }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-ink md:text-[22px]">
          {icon}
          {title}
        </h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, action }: { eyebrow?: ReactNode; title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between animate-rise">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">{eyebrow}</div>}
        <h1 className="font-display text-3xl font-semibold leading-[1.1] tracking-tight text-ink md:text-4xl">{title}</h1>
        {sub && <p className="mt-2 max-w-2xl text-[15px] text-muted">{sub}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

const TONE = {
  neutral: "bg-sand text-ink-soft",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  rust: "bg-rust-100 text-rust-700",
  sky: "bg-sky-100 text-sky-700",
  dark: "bg-forest-800 text-emerald-100",
  outline: "border border-line-strong text-ink-soft",
};
export type Tone = keyof typeof TONE;

export function Badge({ tone = "neutral", className, children, title }: { tone?: Tone; className?: string; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold", TONE[tone], className)}>
      {children}
    </span>
  );
}

export function DataKindBadge({ kind, className }: { kind: DataKind; className?: string }) {
  const { t } = useApp();
  const tone: Tone = kind === "live" ? "green" : kind === "historical" ? "sky" : kind === "illustrative" ? "amber" : "outline";
  const Icon = kind === "live" ? Radio : kind === "illustrative" ? Info : FlaskConical;
  return (
    <Badge tone={tone} className={className}>
      <Icon className="size-3.5" aria-hidden />
      {t(`kind.data.${kind}`)}
    </Badge>
  );
}

export function QualityBadge({ level, compact, className }: { level: QualityLevel; compact?: boolean; className?: string }) {
  const { t } = useApp();
  const tone: Tone = level === "High" ? "green" : level === "Medium" ? "amber" : "rust";
  const Icon = level === "High" ? BadgeCheck : level === "Medium" ? CircleAlert : TriangleAlert;
  return (
    <Badge tone={tone} className={className} title={t("quality.label")}>
      <Icon className="size-3.5" aria-hidden />
      {compact ? t(`quality.${level}`) : `${t("quality.label")}: ${t(`quality.${level}`)}`}
    </Badge>
  );
}

export function FeedStatusDot({ status }: { status: FeedStatus }) {
  const c = status === "ok" ? "bg-emerald-500" : status === "stale" ? "bg-amber-500" : "bg-rust-600";
  return (
    <span className="relative inline-flex size-2.5">
      {status === "ok" && <span className={cx("absolute inset-0 animate-ping rounded-full opacity-40", c)} />}
      <span className={cx("relative inline-flex size-2.5 rounded-full", c)} />
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap rounded-2xl border border-line bg-sand/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "rounded-xl font-bold transition-all cursor-pointer",
            size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm",
            value === o.value ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Notice({ tone = "amber", icon, children, className }: { tone?: "amber" | "rust" | "green" | "sky"; icon?: ReactNode; children: ReactNode; className?: string }) {
  const tones = {
    amber: "bg-amber-50 border-amber-300/60 text-amber-700",
    rust: "bg-rust-50 border-rust-100 text-rust-700",
    green: "bg-emerald-50 border-emerald-100 text-emerald-700",
    sky: "bg-sky-100/60 border-sky-100 text-sky-700",
  };
  return (
    <div className={cx("flex gap-3 rounded-2xl border px-4 py-3 text-sm", tones[tone], className)}>
      <span className="mt-0.5 shrink-0">{icon ?? <Info className="size-4" />}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className)} aria-hidden />;
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line-strong bg-paper/60 px-6 py-10 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-sage-100 text-forest-700">{icon}</div>
      <div className="font-display text-lg font-semibold">{title}</div>
      {children && <div className="mt-2 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}
