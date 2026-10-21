"use client";

import type { StoragePoint } from "@/lib/domain/types";
import { inr } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";

/** Net ₹/qtl vs storage days, with the uncertainty band. */
export function StorageChart({ points, selectedDays }: { points: StoragePoint[]; selectedDays: number }) {
  const { t } = useApp();
  const W = 640;
  const H = 240;
  const pad = { l: 64, r: 16, t: 16, b: 34 };
  const maxDays = Math.max(...points.map((p) => p.days));
  const lo = Math.min(...points.map((p) => p.net.low));
  const hi = Math.max(...points.map((p) => p.net.high));
  const step = 100;
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hi / step) * step;
  const x = (d: number) => pad.l + (d / maxDays) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const sellNow = points[0].net.expected;

  const band = [...points.map((p) => `${x(p.days)},${y(p.net.high)}`), ...[...points].reverse().map((p) => `${x(p.days)},${y(p.net.low)}`)].join(" ");
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.days)},${y(p.net.expected)}`).join(" ");
  const ticks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);
  const sel = points.find((p) => p.days === selectedDays);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t("rec.storageTitle")}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray="2 4" />
          <text x={pad.l - 10} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-faint)" className="tabular">
            {inr(v)}
          </text>
        </g>
      ))}
      <polygon points={band} fill="var(--color-emerald-500)" opacity="0.14" />
      <line x1={pad.l} x2={W - pad.r} y1={y(sellNow)} y2={y(sellNow)} stroke="var(--color-forest-800)" strokeWidth="1.5" strokeDasharray="6 5" />
      <text x={W - pad.r} y={y(sellNow) - 6} textAnchor="end" fontSize="11" fontWeight="700" fill="var(--color-forest-800)">
        {t("rec.sellNow")} {inr(sellNow)}
      </text>
      <path d={line} fill="none" stroke="var(--color-emerald-600)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map((p) => (
        <g key={p.days}>
          <circle
            cx={x(p.days)}
            cy={y(p.net.expected)}
            r={p.days === selectedDays ? 6 : 4}
            fill={p.days === selectedDays ? "var(--color-amber-500)" : "var(--color-paper)"}
            stroke={p.days === selectedDays ? "var(--color-amber-700)" : "var(--color-emerald-600)"}
            strokeWidth="2"
          />
          <text x={x(p.days)} y={H - 12} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
            {p.days === 0 ? t("rec.today") : `${p.days} ${t("common.days")}`}
          </text>
        </g>
      ))}
      {sel && sel.days > 0 && (
        <g>
          <line x1={x(sel.days)} x2={x(sel.days)} y1={y(sel.net.high)} y2={y(sel.net.low)} stroke="var(--color-amber-700)" strokeWidth="1.5" />
          <text x={x(sel.days) + (sel.days === maxDays ? -8 : 8)} y={y(sel.net.expected) - 10} textAnchor={sel.days === maxDays ? "end" : "start"} fontSize="12" fontWeight="800" fill="var(--color-ink)">
            {inr(sel.net.expected)}
          </text>
        </g>
      )}
    </svg>
  );
}
