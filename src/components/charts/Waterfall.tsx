"use client";

import type { CostLine, NetResult } from "@/lib/domain/types";
import { inr } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";
import { cx } from "@/components/ui/primitives";

const GROUP_ORDER: CostLine["group"][] = ["transport", "market", "handling", "quality", "storage", "other"];
const GROUP_COLOR: Record<CostLine["group"], string> = {
  transport: "bg-amber-500",
  market: "bg-amber-300",
  handling: "bg-sage-400",
  quality: "bg-rust-600",
  storage: "bg-sky-700",
  other: "bg-forest-600",
};

/** Axis floor so cost steps stay visible; always disclosed on the chart. */
export function niceFloor(minValue: number, maxValue: number) {
  const span = Math.max(1, maxValue - minValue);
  const raw = minValue - span * 0.6;
  const step = raw > 2000 ? 500 : 100;
  return Math.max(0, Math.floor(raw / step) * step);
}

export function Waterfall({ net, dark }: { net: NetResult; dark?: boolean }) {
  const { t } = useApp();
  const price = net.price.expected;
  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    lines: net.costs.filter((c) => c.group === g),
  }))
    .map((x) => ({ ...x, total: x.lines.reduce((s, c) => s + (c.perQtl ?? 0), 0), unknown: x.lines.some((c) => c.perQtl === null) }))
    .filter((x) => x.lines.length > 0 && (x.total > 0 || x.unknown));

  const netV = net.netPerQtl.expected;
  const floor = niceFloor(netV, price);
  const span = price - floor;
  const pct = (v: number) => ((v - floor) / span) * 100;

  // Each cost step starts where the previous one ended (price − costs so far).
  const rows = groups.map((g, i) => {
    const before = price - groups.slice(0, i).reduce((s, x) => s + x.total, 0);
    const from = before - g.total;
    return { ...g, left: pct(from), width: Math.max(0.6, pct(before) - pct(from)) };
  });

  const label = (key: CostLine["group"]) => {
    const lines = groups.find((g) => g.group === key)!.lines;
    return lines.length === 1 ? t(`cost.${lines[0].key}`) : t(`group.${key}`).replace(/^./, (c) => c.toUpperCase());
  };

  const text = dark ? "text-sage-200" : "text-ink-soft";
  const track = dark ? "bg-white/6" : "bg-sand/70";

  return (
    <div className="space-y-2.5" role="img" aria-label={`${t("rec.waterfall")}: ${inr(price)} − ${inr(net.knownCostPerQtl)} = ${inr(netV)}`}>
      <Row label={t("rec.salePrice")} value={inr(price)} left={0} width={100} bar={dark ? "bg-sage-300" : "bg-forest-800"} text={text} track={track} strong />
      {rows.map((r) => (
        <Row
          key={r.group}
          label={label(r.group)}
          value={r.unknown && r.total === 0 ? t("rec.unknown") : `− ${inr(r.total)}`}
          left={r.left}
          width={r.width}
          bar={GROUP_COLOR[r.group]}
          text={text}
          track={track}
          warn={r.unknown}
        />
      ))}
      <Row label={t("home.example.net")} value={inr(netV)} left={0} width={pct(netV)} bar="bg-emerald-500" text={text} track={track} strong accent />
      <div className={cx("pt-1 text-[11px]", dark ? "text-sage-400" : "text-faint")}>
        {t("chart.scale", { floor })}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  left,
  width,
  bar,
  text,
  track,
  strong,
  accent,
  warn,
}: {
  label: string;
  value: string;
  left: number;
  width: number;
  bar: string;
  text: string;
  track: string;
  strong?: boolean;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="grid grid-cols-[minmax(92px,32%)_1fr_auto] items-center gap-3 text-[13px]">
      <span className={cx("truncate", text, strong && "font-bold")}>{label}</span>
      <div className={cx("relative h-3.5 overflow-hidden rounded-full", track)}>
        <div
          className={cx("absolute inset-y-0 origin-left rounded-full animate-grow", bar, warn && "bg-[repeating-linear-gradient(45deg,var(--color-rust-600)_0_4px,transparent_4px_8px)]")}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
      <span className={cx("tabular min-w-[68px] text-right", strong ? "font-extrabold" : "font-semibold", accent ? "text-emerald-500" : text, warn && "text-rust-600")}>
        {value}
      </span>
    </div>
  );
}
