"use client";

import type { ReactNode } from "react";
import type { ExplanationItem, QualityReason } from "@/lib/domain/types";
import type { StringKey } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";
import { cx } from "@/components/ui/primitives";

const PREFIX = { why: "why.", change: "change.", assume: "assume.", missing: "missing." } as const;

export function useExplain() {
  const { t } = useApp();
  return {
    item: (kind: keyof typeof PREFIX, e: ExplanationItem) => t(`${PREFIX[kind]}${e.code}` as StringKey, e.params),
    reason: (r: QualityReason) => t(`reason.${r.code}` as StringKey, r.params),
  };
}

export function ExplanationList({
  kind,
  items,
  icon,
  tone = "default",
  empty,
}: {
  kind: keyof typeof PREFIX;
  items: ExplanationItem[];
  icon: ReactNode;
  tone?: "default" | "amber" | "rust" | "dark";
  empty?: string;
}) {
  const { item } = useExplain();
  if (items.length === 0 && empty) return <p className="text-sm text-muted">{empty}</p>;
  const iconTone = {
    default: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rust: "bg-rust-100 text-rust-700",
    dark: "bg-emerald-500/20 text-emerald-300",
  }[tone];
  return (
    <ul className="space-y-3">
      {items.map((e, i) => (
        <li key={`${e.code}-${i}`} className="flex gap-3 text-[15px] leading-snug animate-rise" style={{ animationDelay: `${i * 50}ms` }}>
          <span className={cx("mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg", iconTone)}>{icon}</span>
          <span className={tone === "dark" ? "text-sage-100" : "text-ink-soft"}>{item(kind, e)}</span>
        </li>
      ))}
    </ul>
  );
}
