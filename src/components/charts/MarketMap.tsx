"use client";

import type { RecommendationOption } from "@/lib/domain/types";
import { MARKETS } from "@/lib/data/markets";
import { inr } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";

/**
 * Schematic map (no tile server): equirectangular projection of approximate
 * coordinates, so it works offline. Lines are drawn to markets that were compared.
 */
export function MarketMap({
  origin,
  options,
  bestId,
  radiusKm,
}: {
  origin: { lat: number; lng: number; label: string };
  options: RecommendationOption[];
  bestId: string | null;
  radiusKm: number;
}) {
  const { t } = useApp();
  const W = 640;
  const H = 400;
  const pad = 36;
  const pts = [origin, ...MARKETS];
  const minLat = Math.min(...pts.map((p) => p.lat)) - 0.08;
  const maxLat = Math.max(...pts.map((p) => p.lat)) + 0.08;
  const minLng = Math.min(...pts.map((p) => p.lng)) - 0.1;
  const maxLng = Math.max(...pts.map((p) => p.lng)) + 0.1;
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const sx = (W - 2 * pad) / ((maxLng - minLng) * kx);
  const sy = (H - 2 * pad) / (maxLat - minLat);
  const s = Math.min(sx, sy);
  const ox = (W - (maxLng - minLng) * kx * s) / 2;
  const oy = (H - (maxLat - minLat) * s) / 2;
  const px = (lng: number) => ox + (lng - minLng) * kx * s;
  const py = (lat: number) => oy + (maxLat - lat) * s;
  const kmPerUnit = 111.32; // km per degree latitude
  const radiusPx = (radiusKm / 1.3 / kmPerUnit) * s; // straight-line equivalent of the road radius

  const byMarket = new Map(options.filter((o) => o.marketId && o.kind !== "store" && o.kind !== "fpo").map((o) => [o.marketId!, o]));
  const best = options.find((o) => o.id === bestId);
  const scaleKm = 25;
  const scalePx = (scaleKm / kmPerUnit) * s;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-2xl bg-[#eef0e3]" role="img" aria-label={t("rec.mapTitle")}>
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke="#dfe3d1" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        <circle cx={px(origin.lng)} cy={py(origin.lat)} r={radiusPx} fill="var(--color-emerald-500)" opacity="0.06" stroke="var(--color-emerald-600)" strokeOpacity="0.35" strokeDasharray="4 6" />
        {MARKETS.map((m) => {
          const o = byMarket.get(m.id);
          if (!o) return null;
          const isBest = best?.marketId === m.id && (best.kind === "move" || best.kind === "sell_nearby");
          return (
            <line
              key={`l-${m.id}`}
              x1={px(origin.lng)}
              y1={py(origin.lat)}
              x2={px(m.lng)}
              y2={py(m.lat)}
              stroke={isBest ? "var(--color-emerald-600)" : o.eligible ? "var(--color-forest-700)" : "var(--color-rust-600)"}
              strokeOpacity={isBest ? 1 : 0.28}
              strokeWidth={isBest ? 3.5 : 1.5}
              strokeDasharray={o.eligible ? undefined : "4 4"}
            />
          );
        })}
        {MARKETS.map((m) => {
          const o = byMarket.get(m.id);
          const isBest = best?.marketId === m.id && (best.kind === "move" || best.kind === "sell_nearby");
          const x = px(m.lng);
          const y = py(m.lat);
          const anchor = x > W - 140 ? "end" : "start";
          const dx = anchor === "end" ? -10 : 10;
          return (
            <g key={m.id} opacity={o ? 1 : 0.4}>
              <circle cx={x} cy={y} r={isBest ? 9 : 6} fill={isBest ? "var(--color-emerald-500)" : o?.eligible ? "var(--color-forest-800)" : "#9aa293"} stroke="#fff" strokeWidth="2" />
              <text x={x + dx} y={y - 2} textAnchor={anchor} fontSize="12.5" fontWeight={isBest ? 800 : 600} fill="var(--color-ink)" paintOrder="stroke" stroke="#eef0e3" strokeWidth="4">
                {m.name}
              </text>
              {o?.net && (
                <text x={x + dx} y={y + 13} textAnchor={anchor} fontSize="11" fill={isBest ? "var(--color-emerald-700)" : "var(--color-muted)"} fontWeight="700" paintOrder="stroke" stroke="#eef0e3" strokeWidth="4">
                  {o.distanceKm} km · {inr(o.net.netPerQtl.expected)}
                </text>
              )}
            </g>
          );
        })}
        <g>
          <circle cx={px(origin.lng)} cy={py(origin.lat)} r="11" fill="var(--color-amber-500)" stroke="#fff" strokeWidth="3" />
          <circle cx={px(origin.lng)} cy={py(origin.lat)} r="3.5" fill="#fff" />
          <text x={px(origin.lng)} y={py(origin.lat) + 28} textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--color-amber-700)" paintOrder="stroke" stroke="#eef0e3" strokeWidth="4">
            {origin.label}
          </text>
        </g>
        <g transform={`translate(${W - pad - scalePx}, ${H - 18})`}>
          <line x1="0" x2={scalePx} y1="0" y2="0" stroke="var(--color-ink)" strokeWidth="2" />
          <line x1="0" x2="0" y1="-4" y2="4" stroke="var(--color-ink)" strokeWidth="2" />
          <line x1={scalePx} x2={scalePx} y1="-4" y2="4" stroke="var(--color-ink)" strokeWidth="2" />
          <text x={scalePx / 2} y="-7" textAnchor="middle" fontSize="10.5" fill="var(--color-ink)">
            {scaleKm} km (straight line)
          </text>
        </g>
        <text x="14" y="22" fontSize="13" fontWeight="800" fill="var(--color-forest-800)">N ↑</text>
      </svg>
      <p className="mt-2 text-xs text-muted">{t("rec.mapNote")}</p>
    </div>
  );
}
