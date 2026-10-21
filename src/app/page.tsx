"use client";

import Link from "next/link";
import { ArrowRight, ChartLine, Citrus, Handshake, Info, Sprout, TriangleAlert, Users, Wheat, Warehouse, Bean } from "lucide-react";
import { SCENARIOS, SCENARIO_BY_ID, scenarioLotId } from "@/lib/data/scenarios";
import { MARKET_BY_ID } from "@/lib/data/markets";
import { COMMODITIES } from "@/lib/data/commodities";
import { computeNet } from "@/lib/engine/net";
import { inr } from "@/lib/i18n";
import { PRE_HYDRATION_DATE, useApp } from "@/lib/store/AppProvider";
import { ButtonLink, Card, DataKindBadge, cx } from "@/components/ui/primitives";
import type { CostLine } from "@/lib/domain/types";

const SCENARIO_ICON = { A: Sprout, B: Citrus, C: Warehouse, D: Users, E: TriangleAlert } as const;

function illustrativeExample() {
  const s = SCENARIO_BY_ID.A;
  const lot = s.buildLot(PRE_HYDRATION_DATE);
  return Object.entries(s.illustrative!).map(([marketId, m]) => {
    const transport = m.costs.find((c) => c.key === "transport")!.perQtl;
    const costs: CostLine[] = m.costs.map((c) => ({ key: c.key, group: "other", perQtl: c.perQtl, basis: "illustrative", detail: c.detail, editable: false }));
    const net = computeNet(lot.quantityQtl, { low: m.price, expected: m.price, high: m.price }, costs);
    return { marketId, name: MARKET_BY_ID[marketId].name, quote: m.price, transport, other: net.knownCostPerQtl - transport, net: net.netPerQtl.expected, qty: lot.quantityQtl };
  });
}

export default function Home() {
  const { t, lang } = useApp();
  const rows = illustrativeExample();
  const best = [...rows].sort((a, b) => b.net - a.net)[0];
  const other = rows.find((r) => r !== best)!;
  const maxQuote = Math.max(...rows.map((r) => r.quote));
  const floor = 4000;
  const pct = (v: number) => ((v - floor) / (maxQuote - floor)) * 100;

  const roles = [
    { href: "/farmer", icon: Sprout, title: t("role.farmer"), desc: t("role.farmerDesc"), accent: true },
    { href: "/buyer", icon: Handshake, title: t("role.buyer"), desc: t("role.buyerDesc") },
    { href: "/fpo", icon: Users, title: t("role.fpo"), desc: t("role.fpoDesc") },
    { href: "/insights", icon: ChartLine, title: t("role.insights"), desc: t("role.insightsDesc") },
  ];

  return (
    <div className="space-y-12 md:space-y-16">
      <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
        <div className="animate-rise">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {t("home.eyebrow")}
          </div>
          <h1 className="font-display text-[40px] font-semibold leading-[1.02] tracking-tight text-ink sm:text-5xl lg:text-[60px]">{t("home.title")}</h1>
          <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-muted">{t("home.sub")}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/farmer/new" size="lg">
              {t("home.cta")} <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href={`/farmer/lots/${scenarioLotId("A")}`} size="lg" variant="secondary">
              {t("home.ctaScenario")}
            </ButtonLink>
          </div>
        </div>

        <div className="panel-dark grain relative overflow-hidden p-6 shadow-[var(--shadow-lift)] md:p-7 animate-rise [animation-delay:120ms]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold text-sage-200">{t("home.example.title")}</div>
            <DataKindBadge kind="illustrative" />
          </div>
          <div className="mt-1 text-xs text-sage-400">
            {COMMODITIES.soybean.name[lang]} · {best.qty} {t("common.qtl")} · ₹/{t("common.qtl")}
          </div>

          <div className="mt-6 space-y-5">
            {[other, best].map((r) => {
              const isBest = r === best;
              return (
                <div key={r.marketId}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className={cx("font-display text-xl font-semibold", isBest ? "text-white" : "text-sage-200")}>{r.name}</span>
                    <span className="tabular text-xs text-sage-400">
                      {t("home.example.quote")} {inr(r.quote)} − {t("home.example.transport")} {inr(r.transport)} − {t("home.example.other")} {inr(r.other)}
                    </span>
                  </div>
                  <div className="relative h-9 overflow-hidden rounded-xl bg-white/6">
                    <div className="absolute inset-y-0 left-0 origin-left rounded-xl bg-amber-300/80 animate-grow" style={{ width: `${pct(r.quote)}%` }} />
                    <div
                      className={cx("absolute inset-y-0 left-0 flex origin-left items-center rounded-xl px-3 animate-grow", isBest ? "bg-emerald-500" : "bg-sage-400")}
                      style={{ width: `${pct(r.net)}%` }}
                    >
                      <span className="tabular text-sm font-extrabold text-forest-950">
                        {t("home.example.net")} {inr(r.net)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex items-end gap-4 border-t border-white/10 pt-5">
            <div className="font-display text-5xl font-semibold leading-none text-emerald-300">+{inr((best.net - other.net) * best.qty)}</div>
            <p className="pb-1 text-sm leading-snug text-sage-200">{t("home.example.result")}</p>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-[11px] text-sage-400">
            <Info className="size-3.5" /> Illustrative figures from the product brief. Amber = costs; scale starts at {inr(floor)}.
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-sage-100/70 px-5 py-4 text-center font-display text-lg text-forest-800 md:text-xl">
        “{t("home.principle")}”
      </section>

      <section>
        <h2 className="mb-4 font-display text-2xl font-semibold tracking-tight">{t("home.roles")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roles.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className={cx(
                "group card flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]",
                r.accent && "border-emerald-300/60 bg-emerald-50",
              )}
            >
              <span className={cx("mb-4 grid size-11 place-items-center rounded-2xl", r.accent ? "bg-emerald-600 text-white" : "bg-sage-100 text-forest-700")}>
                <r.icon className="size-5" />
              </span>
              <span className="font-display text-lg font-semibold">{r.title}</span>
              <span className="mt-1 text-sm text-muted">{r.desc}</span>
              <ArrowRight className="mt-4 size-4 text-emerald-600 transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{t("home.scenarios")}</h2>
          <p className="mt-1 text-sm text-muted">{t("home.scenariosSub")}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {SCENARIOS.map((s) => {
            const Icon = SCENARIO_ICON[s.id];
            const crop = s.buildLot(PRE_HYDRATION_DATE).commodityId;
            const CropIcon = crop === "orange" ? Citrus : crop === "soybean" ? Bean : Wheat;
            return (
              <Card key={s.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-2xl bg-forest-900 font-display text-lg font-semibold text-emerald-300">{s.id}</span>
                  <span className="flex items-center gap-1.5 text-muted">
                    <CropIcon className="size-4" />
                    <Icon className="size-4" />
                  </span>
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{s.title[lang]}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{s.summary[lang]}</p>
                <div className="mt-4 flex items-center justify-between">
                  <DataKindBadge kind={s.illustrative ? "illustrative" : "demo"} />
                  <ButtonLink href={`/farmer/lots/${scenarioLotId(s.id)}`} size="sm" variant="secondary">
                    {t("home.open")} <ArrowRight className="size-3.5" />
                  </ButtonLink>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
