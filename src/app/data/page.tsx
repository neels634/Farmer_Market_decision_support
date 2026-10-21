"use client";

import { useState } from "react";
import { BookOpen, Database, PlugZap, RotateCcw, Scale, SlidersHorizontal, Truck, Unplug } from "lucide-react";
import type { DemoSettings, FeedStatus } from "@/lib/domain/types";
import { MARKETS, defaultSettings } from "@/lib/data/markets";
import { DATA_SOURCES } from "@/lib/data/sources";
import { BASE_RANGE_PCT, PAYMENT_RISK_PCT, RISK_WEIGHT } from "@/lib/engine/recommend";
import { useApp } from "@/lib/store/AppProvider";
import { Badge, Button, Card, DataKindBadge, FeedStatusDot, Notice, PageHeader, SectionTitle, Segmented, Skeleton, cx } from "@/components/ui/primitives";

export default function DataPage() {
  const { t, hydrated, settings, setSettings, resetAll, lang } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  if (!hydrated) return <Skeleton className="h-96" />;

  const patch = (p: Partial<DemoSettings>) => setSettings({ ...settings, ...p });
  const setFeed = (id: string, status: FeedStatus) =>
    patch({ feeds: { ...settings.feeds, [id]: { status, ageDays: status === "stale" ? 9 : status === "ok" ? 1 : 0 } } });
  const allOk = Object.values(settings.feeds).every((f) => f.status === "ok" && f.ageDays <= 2);

  return (
    <div>
      <PageHeader eyebrow={t("nav.data")} title={t("data.title")} sub={t("data.sub")} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title={t("data.sources")} icon={<Database className="size-5 text-emerald-600" />} />
          <ul className="space-y-3">
            {DATA_SOURCES.map((s) => (
              <li key={s.id} className="flex gap-3 rounded-xl border border-line p-3">
                <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl", s.connected ? "bg-emerald-100 text-emerald-700" : "bg-sand text-faint")}>
                  {s.connected ? <PlugZap className="size-4" /> : <Unplug className="size-4" />}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-bold">{s.name}</span>
                    {s.connected ? <DataKindBadge kind={s.kind} /> : <Badge tone="outline">{t("data.notConnected")}</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{s.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionTitle
            title={t("data.feeds")}
            sub={t("data.feedsSub")}
            icon={<SlidersHorizontal className="size-5 text-amber-600" />}
            action={
              !allOk ? (
                <Button size="sm" variant="secondary" onClick={() => patch({ feeds: defaultSettings().feeds })}>
                  <RotateCcw className="size-3.5" /> {t("feed.ok")}
                </Button>
              ) : undefined
            }
          />
          <ul className="divide-y divide-line">
            {MARKETS.map((m) => {
              const f = settings.feeds[m.id] ?? { status: "ok", ageDays: 1 };
              return (
                <li key={m.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                  <span className="flex items-center gap-2 text-sm font-bold">
                    <FeedStatusDot status={f.status === "ok" && f.ageDays > 7 ? "stale" : f.status} /> {m.name}
                  </span>
                  <span className="flex items-center justify-between gap-2 sm:justify-end">
                    {f.status !== "unavailable" && (
                      <label className="flex items-center gap-1 text-xs text-muted">
                        {t("feed.age")}
                        <input
                          type="number"
                          min={0}
                          max={60}
                          className="input tabular min-h-9! w-16 px-2! py-1! text-sm"
                          value={f.ageDays}
                          onChange={(e) => {
                            const n = Math.max(0, Math.min(60, Math.round(Number(e.target.value) || 0)));
                            patch({ feeds: { ...settings.feeds, [m.id]: { ...f, ageDays: n } } });
                          }}
                        />
                      </label>
                    )}
                    <Segmented<FeedStatus>
                      size="sm"
                      label={m.name}
                      value={f.status}
                      onChange={(v) => setFeed(m.id, v)}
                      options={[
                        { value: "ok", label: t("feed.ok") },
                        { value: "stale", label: t("feed.stale") },
                        { value: "unavailable", label: t("feed.unavailable") },
                      ]}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionTitle title={t("data.rules")} icon={<Scale className="size-5 text-forest-700" />} />
          <div className="space-y-4">
            <label className="flex items-start gap-3 rounded-xl border border-line p-3">
              <input type="checkbox" className="mt-1 size-4 accent-emerald-600" checked={settings.directBuyerAllowed} onChange={(e) => patch({ directBuyerAllowed: e.target.checked })} />
              <span>
                <span className="block font-bold">{t("data.directAllowed")}</span>
                <span className="block text-xs text-muted">{t("data.directNote")}</span>
              </span>
            </label>
            <NumberRow label={t("data.interest")} value={settings.monthlyInterestPct} step={0.25} min={0} max={10} onChange={(v) => patch({ monthlyInterestPct: v })} />
            <NumberRow label={t("data.loading")} value={settings.farmLoadingPerQtl} min={0} max={200} onChange={(v) => patch({ farmLoadingPerQtl: v })} />
            <NumberRow label={t("data.roadFactor")} value={settings.roadFactor} step={0.05} min={1} max={2} onChange={(v) => patch({ roadFactor: v })} />
            <NumberRow label={t("data.sameDay")} value={settings.sameDayMaxKm} min={10} max={500} onChange={(v) => patch({ sameDayMaxKm: v })} />
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title={t("data.vehicleRates")} icon={<Truck className="size-5 text-amber-600" />} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-faint">
                  <th className="pb-2" />
                  <th className="pb-2">{t("data.capacity")}</th>
                  <th className="pb-2">{t("data.fixed")}</th>
                  <th className="pb-2">{t("data.perKm")}</th>
                </tr>
              </thead>
              <tbody>
                {settings.vehicles.map((v, i) => (
                  <tr key={v.id}>
                    <td className="py-1.5 pr-2 font-bold">{v.label[lang]}</td>
                    {(["capacityQtl", "fixedPerTrip", "perKm"] as const).map((k) => (
                      <td key={k} className="py-1.5 pr-2">
                        <input
                          type="number"
                          min={k === "capacityQtl" ? 1 : 0}
                          className="input tabular min-h-9! w-24 px-2! py-1! text-sm"
                          value={v[k]}
                          aria-label={`${v.label.en} ${k}`}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (!Number.isFinite(n) || n < (k === "capacityQtl" ? 1 : 0)) return;
                            const vehicles = settings.vehicles.map((x, j) => (j === i ? { ...x, [k]: n } : x));
                            patch({ vehicles });
                          }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 border-t border-line pt-4">
            {!confirming ? (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                <RotateCcw className="size-4" /> {t("data.reset")}
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{t("data.resetConfirm")}</span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    resetAll();
                    setConfirming(false);
                    setDone(true);
                  }}
                >
                  {t("common.confirm")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            )}
            {done && <p className="mt-2 text-sm font-semibold text-emerald-700">{t("data.resetDone")}</p>}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5 md:p-7">
        <SectionTitle title={t("data.method")} icon={<BookOpen className="size-5 text-emerald-600" />} />
        <div className="grid gap-6 text-sm leading-relaxed text-ink-soft md:grid-cols-2">
          <div className="space-y-3">
            <p>
              <b>Net realisation.</b> For every option: <i>net = expected sale price − transport − loading/unloading − market charges − commission − quality loss − storage − other costs</i>, all in ₹/quintal, then × quantity for the lot. Each cost key may appear once per option (no double counting). Unknown costs are never treated as zero: the net is marked as an upper bound and data quality drops.
            </p>
            <p>
              <b>Price range.</b> Everyday variation ±{BASE_RANGE_PCT}%, widened for older data (+3% at 3–7 days, +6% when stale) and unknown grade (+5%). Storage adds the seasonal reference ratio and widens with √months. These are transparent rules, not statistical confidence intervals.
            </p>
            <p>
              <b>Ranking.</b> Eligible options are ranked by expected net minus a risk-preference weight ({RISK_WEIGHT.cautious} / {RISK_WEIGHT.balanced} / {RISK_WEIGHT.patient} for cautious / balanced / can wait) times the downside beyond everyday variation. With fresh market data this is simply the highest expected net.
            </p>
          </div>
          <div className="space-y-3">
            <p>
              <b>Data quality (High / Medium / Low).</b> Starts High; drops for data 3+ days old, any unknown cost, unknown grade, low buyer reliability, or an aged buyer posting; capped at Medium for storage forecasts and Low beyond 2 months or for stale data. If every option is Low, the app says it does not have enough reliable data to recommend confidently.
            </p>
            <p>
              <b>Eligibility.</b> Options are set aside (with the reason shown) when beyond the farmer&apos;s distance limit, past the crop&apos;s shelf life, without a usable price, outside a buyer&apos;s grade/quantity/date terms, or paying later than the farmer needs cash. Payment risk for direct buyers is an expected-loss allowance ({PAYMENT_RISK_PCT.High}% / {PAYMENT_RISK_PCT.Medium}% / {PAYMENT_RISK_PCT.Low}% for High / Medium / Low reliability).
            </p>
            <Notice tone="sky">This is a deterministic, rule-based engine. It is not a trained or validated ML model, and no accuracy figures are claimed.</Notice>
          </div>
        </div>
      </Card>
    </div>
  );
}

function NumberRow({ label, value, onChange, step = 1, min, max }: { label: string; value: number; onChange: (n: number) => void; step?: number; min: number; max: number }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-soft">{label}</span>
      <input
        type="number"
        className="input tabular min-h-10! w-24 text-right"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
      />
    </label>
  );
}
