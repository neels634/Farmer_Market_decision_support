"use client";

import { useMemo, useState } from "react";
import { Activity, ChartLine, Clock, Gauge, Truck } from "lucide-react";
import type { CommodityId, MarketFeed } from "@/lib/domain/types";
import { COMMODITIES, COMMODITY_LIST } from "@/lib/data/commodities";
import { MARKETS, MARKET_BY_ID } from "@/lib/data/markets";
import { getFeedsForCommodity } from "@/lib/data/sources";
import { detectAnomalies, pctChange } from "@/lib/engine/insights";
import { inr, type StringKey } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";
import { Badge, Card, DataKindBadge, FeedStatusDot, Notice, PageHeader, SectionTitle, Segmented, Skeleton, cx } from "@/components/ui/primitives";
import { SERIES_COLORS, Sparkline, TrendChart } from "@/components/charts/TrendChart";

export default function InsightsPage() {
  const { t, lang, hydrated, settings, now, metrics, allLots } = useApp();
  const [crop, setCrop] = useState<CommodityId>("soybean");
  const feeds = useMemo(() => (hydrated ? getFeedsForCommodity(crop, settings, now) : []), [hydrated, crop, settings, now]);
  const [picked, setPicked] = useState<string[]>(["nagpur", "wardha", "umred"]);
  const allFeeds = useMemo(
    () => (hydrated ? (["orange", "soybean", "tur"] as CommodityId[]).flatMap((c) => getFeedsForCommodity(c, settings, now)) : []),
    [hydrated, settings, now],
  );
  const anomalies = useMemo(() => detectAnomalies(allFeeds), [allFeeds]);

  if (!hydrated) return <Skeleton className="h-96" />;

  const available = feeds.filter((f) => f.latest);
  const selected = picked.map((id) => available.find((f) => f.marketId === id)).filter((f): f is MarketFeed => !!f);
  const shown = selected.length ? selected : available.slice(0, 3);
  const primary = shown[0];

  const lotMetrics = Object.values(metrics.byLot);
  const diffs = lotMetrics.map((m) => m.diffPerQtl).filter((d): d is number => d !== null);
  const sum = (k: "optionsCompared" | "optionsWithCompleteCosts" | "optionsWithProvenance" | "staleOrMissingFeeds" | "feedsConsidered") => lotMetrics.reduce((s, m) => s + m[k], 0);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

  return (
    <div>
      <PageHeader
        eyebrow={t("role.insights")}
        title={t("ins.title")}
        sub={t("ins.sub")}
        action={
          <Segmented<CommodityId>
            label={t("fpo.crop")}
            value={crop}
            onChange={(c) => setCrop(c)}
            options={COMMODITY_LIST.map((c) => ({ value: c.id, label: c.name[lang] }))}
          />
        }
      />
      <Notice tone="amber" className="mb-6">
        {t("assume.demo_prices")}
      </Notice>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <SectionTitle
            title={`${t("ins.trend")} · ${COMMODITIES[crop].name[lang]}`}
            sub="₹/qtl · 60 days · band = min–max at the first market"
            icon={<ChartLine className="size-5 text-emerald-600" />}
            action={<DataKindBadge kind="demo" />}
          />
          <div className="mb-3 flex flex-wrap gap-1.5">
            {available.map((f) => {
              const idx = shown.findIndex((s) => s.marketId === f.marketId);
              const on = idx >= 0;
              return (
                <button
                  key={f.marketId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPicked((p) => (p.includes(f.marketId) ? p.filter((x) => x !== f.marketId) : [...p, f.marketId].slice(-6)))}
                  className={cx("inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-bold", on ? "border-transparent bg-forest-900 text-white" : "border-line bg-paper text-muted hover:text-ink")}
                >
                  {on && <span className="size-2 rounded-full" style={{ background: SERIES_COLORS[idx % SERIES_COLORS.length] }} />}
                  {MARKET_BY_ID[f.marketId].name}
                </button>
              );
            })}
          </div>
          <TrendChart feeds={shown} />
          {primary && (
            <div className="mt-5">
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <Truck className="size-4 text-amber-600" /> {t("ins.arrivals")} · {MARKET_BY_ID[primary.marketId].name}
              </div>
              <ArrivalBars feed={primary} />
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle title={t("ins.anomalies")} icon={<Activity className="size-5 text-rust-600" />} />
            {anomalies.length === 0 ? (
              <p className="text-sm text-muted">{t("ins.noAnomalies")}</p>
            ) : (
              <ul className="space-y-3">
                {anomalies.map((a, i) => (
                  <li key={i} className="rounded-xl border border-line bg-ivory/60 p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={a.kind === "arrival_spike" ? "amber" : "rust"}>{a.kind.replace("_", " ")}</Badge>
                      <span className="text-sm font-bold">
                        {MARKET_BY_ID[a.marketId].name} · {COMMODITIES[a.commodityId].name[lang]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">{a.detail}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted">Experimental rules (z-score of daily change, bidder count vs. regional median, arrivals vs. 14-day average) on simulated data.</p>
          </Card>

          <Card className="p-5">
            <SectionTitle title={t("ins.metrics")} sub={t("ins.metricsNote")} icon={<Gauge className="size-5 text-sky-700" />} />
            <div className="grid grid-cols-2 gap-3">
              <Metric label={t("ins.recs")} value={String(metrics.recommendations)} />
              <Metric label={t("ins.avgDiff")} value={diffs.length ? `${inr(diffs.reduce((s, d) => s + d, 0) / diffs.length)}/qtl` : "—"} />
              <Metric label={t("ins.complete")} value={pct(sum("optionsWithCompleteCosts"), sum("optionsCompared"))} />
              <Metric label={t("ins.provenance")} value={pct(sum("optionsWithProvenance"), sum("optionsCompared"))} />
              <Metric label={t("ins.staleRate")} value={pct(sum("staleOrMissingFeeds"), sum("feedsConsidered"))} />
              <Metric label={t("ins.coverage")} value={`${MARKETS.length} ${t("ins.markets").toLowerCase()} · ${COMMODITY_LIST.length} ${t("ins.crops").toLowerCase()} · ${allLots.length} lots`} small />
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="p-5 pb-0">
          <SectionTitle title={`${t("ins.freshness")} · ${COMMODITIES[crop].name[lang]}`} icon={<Clock className="size-5 text-amber-600" />} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-line bg-ivory/70 text-left text-xs uppercase tracking-wide text-faint">
                <th className="px-5 py-2.5">{t("ins.market")}</th>
                <th className="px-3 py-2.5">{t("ins.status")}</th>
                <th className="px-3 py-2.5 text-right">{t("ins.latest")}</th>
                <th className="px-3 py-2.5 text-right">{t("ins.change7")}</th>
                <th className="px-3 py-2.5">30d</th>
                <th className="px-3 py-2.5 text-right">{t("ins.arrivals")}</th>
                <th className="px-3 py-2.5 text-right">{t("ins.bidders")}</th>
                <th className="px-5 py-2.5">{t("ins.updated")}</th>
              </tr>
            </thead>
            <tbody>
              {feeds.map((f) => {
                const ch = f.latest ? pctChange(f, 7) : null;
                return (
                  <tr key={f.marketId} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-bold">{MARKET_BY_ID[f.marketId].name}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2">
                        <FeedStatusDot status={f.provenance.status} /> {t(`feed.${f.provenance.status}` as StringKey)}
                      </span>
                    </td>
                    <td className="tabular px-3 py-3 text-right font-semibold">{f.latest ? inr(f.latest.modalPrice) : "—"}</td>
                    <td className={cx("tabular px-3 py-3 text-right font-semibold", ch === null ? "" : ch >= 0 ? "text-emerald-700" : "text-rust-600")}>
                      {ch === null ? "—" : `${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-3">{f.history.length ? <Sparkline values={f.history.slice(-30).map((o) => o.modalPrice)} /> : "—"}</td>
                    <td className="tabular px-3 py-3 text-right">{f.latest ? f.latest.arrivalsQtl.toLocaleString("en-IN") : "—"}</td>
                    <td className={cx("tabular px-3 py-3 text-right", f.latest?.bidders !== null && (f.latest?.bidders ?? 99) <= 4 && "font-bold text-rust-600")}>{f.latest?.bidders ?? "—"}</td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {f.latest ? f.latest.date : "—"} {f.ageDays !== null && `· ${f.ageDays}d`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-ivory p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={cx("tabular mt-1 font-display font-semibold", small ? "text-sm" : "text-2xl")}>{value}</div>
    </div>
  );
}

function ArrivalBars({ feed }: { feed: MarketFeed }) {
  const h = feed.history.slice(-30);
  const max = Math.max(...h.map((o) => o.arrivalsQtl));
  return (
    <div>
      <div className="flex h-20 items-end gap-[3px]">
        {h.map((o, i) => (
          <div
            key={o.date}
            title={`${o.date}: ${o.arrivalsQtl.toLocaleString("en-IN")} qtl`}
            className={cx("flex-1 rounded-t-sm", i === h.length - 1 ? "bg-amber-500" : "bg-sage-300")}
            style={{ height: `${(o.arrivalsQtl / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>{h[0]?.date.slice(5)}</span>
        <span>qtl / day · last 30 days</span>
        <span>{h[h.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}
