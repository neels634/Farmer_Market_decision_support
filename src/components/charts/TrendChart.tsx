"use client";

import { useState } from "react";
import type { MarketFeed } from "@/lib/domain/types";
import { MARKET_BY_ID } from "@/lib/data/markets";
import { inr } from "@/lib/i18n";

export const SERIES_COLORS = ["#0e8655", "#c27c0e", "#285f7d", "#b2472a", "#5b4a8a", "#1b513d"];

/** Multi-market modal price lines; the first feed also shows its min–max band. */
export function TrendChart({ feeds, height = 260 }: { feeds: MarketFeed[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const series = feeds.filter((f) => f.history.length > 0);
  if (series.length === 0) return <div className="grid h-40 place-items-center text-sm text-muted">No data for this selection.</div>;

  const W = 720;
  const H = height;
  const pad = { l: 60, r: 14, t: 14, b: 28 };
  const n = Math.max(...series.map((s) => s.history.length));
  const primary = series[0];
  const vals = series.flatMap((s) => s.history.map((o) => o.modalPrice)).concat(primary.history.flatMap((o) => [o.minPrice, o.maxPrice]));
  const step = vals[0] > 3000 ? 100 : 50;
  const yMin = Math.floor(Math.min(...vals) / step) * step;
  const yMax = Math.ceil(Math.max(...vals) / step) * step;
  const x = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);
  const ticks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);
  const off = (s: MarketFeed) => n - s.history.length;

  const band =
    primary.history.map((o, i) => `${x(i + off(primary))},${y(o.maxPrice)}`).join(" ") +
    " " +
    [...primary.history]
      .map((o, i) => `${x(i + off(primary))},${y(o.minPrice)}`)
      .reverse()
      .join(" ");

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hoverDate = hover !== null ? primary.history[hover - off(primary)]?.date : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Price trend chart">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray="2 4" />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--color-faint)">
              {inr(v)}
            </text>
          </g>
        ))}
        <polygon points={band} fill={SERIES_COLORS[0]} opacity="0.1" />
        {series.map((s, si) => (
          <path
            key={s.marketId}
            d={s.history.map((o, i) => `${i ? "L" : "M"}${x(i + off(s))},${y(o.modalPrice)}`).join(" ")}
            fill="none"
            stroke={SERIES_COLORS[si % SERIES_COLORS.length]}
            strokeWidth={si === 0 ? 2.5 : 1.75}
            strokeLinejoin="round"
          />
        ))}
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize="11" fill="var(--color-muted)">
            {primary.history[i - off(primary)]?.date.slice(5)}
          </text>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--color-ink)" strokeOpacity="0.3" />
            {series.map((s, si) => {
              const o = s.history[hover - off(s)];
              return o ? <circle key={s.marketId} cx={x(hover)} cy={y(o.modalPrice)} r="4" fill={SERIES_COLORS[si % SERIES_COLORS.length]} stroke="#fff" strokeWidth="1.5" /> : null;
            })}
          </g>
        )}
      </svg>
      {hover !== null && hoverDate && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-xl border border-line bg-paper/95 px-3 py-2 text-xs shadow-lg">
          <div className="mb-1 font-bold text-ink">{hoverDate}</div>
          {series.map((s, si) => {
            const o = s.history[hover - off(s)];
            return o ? (
              <div key={s.marketId} className="tabular flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: SERIES_COLORS[si % SERIES_COLORS.length] }} />
                <span className="text-muted">{MARKET_BY_ID[s.marketId].name}</span>
                <span className="ml-auto font-bold">{inr(o.modalPrice)}</span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, color = "var(--color-emerald-600)", width = 96, height = 28 }: { values: number[]; color?: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${(i / (values.length - 1)) * width},${height - 2 - ((v - min) / (max - min || 1)) * (height - 4)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
    </svg>
  );
}
