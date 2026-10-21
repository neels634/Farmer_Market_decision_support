"use client";

import type { RecommendationOption } from "@/lib/domain/types";
import { inr } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";
import { cx } from "@/components/ui/primitives";
import { niceFloor } from "@/components/charts/Waterfall";

/**
 * For each option: full bar = expected sale price, green part = net after costs,
 * whisker = likely net range. Makes "highest quote ≠ highest net" visible.
 */
export function CompareBars({ options, bestId }: { options: RecommendationOption[]; bestId: string | null }) {
  const { t } = useApp();
  const withNet = options.filter((o) => o.net);
  if (withNet.length === 0) return null;
  const maxPrice = Math.max(...withNet.map((o) => o.net!.price.expected), ...withNet.map((o) => o.net!.netPerQtl.high));
  const minNet = Math.min(...withNet.map((o) => o.net!.netPerQtl.low));
  const floor = niceFloor(minNet, maxPrice);
  const span = maxPrice - floor;
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - floor) / span) * 100));
  const highestQuote = [...withNet].sort((a, b) => b.net!.price.expected - a.net!.price.expected)[0];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-emerald-500" /> {t("home.example.net")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-amber-300" /> {t("rec.totalCosts")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-px bg-ink" /> {t("rec.range")}
        </span>
      </div>
      {withNet.map((o) => {
        const n = o.net!;
        const best = o.id === bestId;
        return (
          <div key={o.id} className="grid grid-cols-[minmax(0,34%)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,28%)_1fr_auto]">
            <div className="min-w-0">
              <div className={cx("truncate text-[13px]", best ? "font-extrabold text-ink" : "font-semibold text-ink-soft")}>
                {o.rank}. {o.title}
              </div>
              <div className="tabular text-[11px] text-faint">
                {t("rec.quote")} {inr(n.price.expected)}
                {o.id === highestQuote.id && withNet.length > 1 && <span className="ml-1 font-bold text-amber-700">▲</span>}
              </div>
            </div>
            <div className="relative h-7">
              <div className="absolute inset-y-1.5 left-0 rounded-full bg-sand/70" style={{ width: "100%" }} />
              <div className="absolute inset-y-1.5 left-0 origin-left rounded-full bg-amber-300 animate-grow" style={{ width: `${pct(n.price.expected)}%` }} />
              <div
                className={cx("absolute inset-y-1.5 left-0 origin-left rounded-full animate-grow", best ? "bg-emerald-500" : "bg-emerald-600/70")}
                style={{ width: `${pct(n.netPerQtl.expected)}%` }}
              />
              <div
                className="absolute top-1/2 h-px -translate-y-1/2 bg-ink/70"
                style={{ left: `${pct(n.netPerQtl.low)}%`, width: `${Math.max(0.5, pct(n.netPerQtl.high) - pct(n.netPerQtl.low))}%` }}
              />
              <div className="absolute top-1 bottom-1 w-px bg-ink/70" style={{ left: `${pct(n.netPerQtl.low)}%` }} />
              <div className="absolute top-1 bottom-1 w-px bg-ink/70" style={{ left: `${pct(n.netPerQtl.high)}%` }} />
            </div>
            <div className={cx("tabular col-start-2 -mt-2 text-right text-sm sm:col-start-auto sm:mt-0 sm:min-w-[84px]", best ? "font-extrabold text-emerald-700" : "font-bold text-ink-soft")}>
              {inr(n.netPerQtl.expected)}
              {n.isUpperBound && <span className="text-rust-600">*</span>}
            </div>
          </div>
        );
      })}
      <div className="text-[11px] text-faint">
        {t("chart.scale", { floor })} · {t("chart.highestQuote")}
        {withNet.some((o) => o.net!.isUpperBound) ? ` · ${t("chart.someUnknown")}` : ""}
      </div>
    </div>
  );
}
