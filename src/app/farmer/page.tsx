"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Bell, Bookmark, Check, Handshake, MapPin, Plus, Sprout, ThumbsDown, Trash2, TrendingUp, TriangleAlert, Truck } from "lucide-react";
import { CROP_ICON } from "@/components/farmer/cropIcon";
import type { CommodityId, MarketFeed, ProduceLot } from "@/lib/domain/types";
import { COMMODITIES, getGrade } from "@/lib/data/commodities";
import { seedBuyerDemands } from "@/lib/data/actors";
import { getFeedsForCommodity } from "@/lib/data/sources";
import { buildAlerts, type Alert } from "@/lib/engine/insights";
import { resolveOrigin, effectiveSettings } from "@/lib/engine/recommend";
import { inr, type StringKey } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";
import { Badge, Button, ButtonLink, Card, DataKindBadge, EmptyState, PageHeader, SectionTitle, Skeleton, cx } from "@/components/ui/primitives";


export default function FarmerDashboard() {
  const { t, hydrated, userLots, scenarioLots, decisions, removeLot, buyerPosts, settings, now, allLots } = useApp();

  const alerts = useMemo(() => {
    if (!hydrated) return [];
    const feeds: Partial<Record<CommodityId, MarketFeed[]>> = {};
    const out: Alert[] = [];
    for (const lot of allLots) {
      const s = effectiveSettings(lot, settings);
      const f = getFeedsForCommodity(lot.commodityId, s, now);
      feeds[lot.commodityId] = f;
      out.push(...buildAlerts([lot], { [lot.commodityId]: f }, [...seedBuyerDemands(now), ...buyerPosts], settings.roadFactor));
    }
    const order = { buyer_demand: 0, price_move: 1, arrivals: 2, stale_data: 3 };
    return out.sort((a, b) => order[a.kind] - order[b.kind]);
  }, [hydrated, allLots, settings, now, buyerPosts]);

  if (!hydrated) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-1/2" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const lotName = (id: string) => {
    const l = allLots.find((x) => x.id === id);
    return l ? `${COMMODITIES[l.commodityId].name.en} · ${l.quantityQtl} qtl` : id;
  };

  return (
    <div>
      <PageHeader
        eyebrow={t("role.farmer")}
        title={t("farmer.title")}
        sub={t("farmer.sub")}
        action={
          <ButtonLink href="/farmer/new" size="lg">
            <Plus className="size-4" /> {t("farmer.add")}
          </ButtonLink>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          <section>
            <SectionTitle title={t("farmer.myLots")} />
            {userLots.length === 0 ? (
              <EmptyState icon={<Sprout className="size-5" />} title={t("farmer.add")}>
                {t("farmer.noLots")}
                <div className="mt-4">
                  <ButtonLink href="/farmer/new">
                    <Plus className="size-4" /> {t("farmer.add")}
                  </ButtonLink>
                </div>
              </EmptyState>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {userLots.map((l) => (
                  <LotCard key={l.id} lot={l} onRemove={() => removeLot(l.id)} />
                ))}
              </div>
            )}
          </section>
          <section>
            <SectionTitle title={t("farmer.scenarioLots")} sub={t("home.scenariosSub")} />
            <div className="grid gap-3 sm:grid-cols-2">
              {scenarioLots.map((l) => (
                <LotCard key={l.id} lot={l} />
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle title={t("farmer.alerts")} icon={<Bell className="size-5 text-amber-600" />} />
            {alerts.length === 0 ? (
              <p className="text-sm text-muted">{t("farmer.noAlerts")}</p>
            ) : (
              <ul className="space-y-2.5">
                {alerts.slice(0, 8).map((a) => (
                  <AlertRow key={a.id} alert={a} lotLabel={lotName(a.lotId)} />
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <SectionTitle title={t("farmer.decisions")} icon={<Bookmark className="size-5 text-emerald-600" />} />
            {decisions.length === 0 ? (
              <p className="text-sm text-muted">{t("farmer.noDecisions")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {decisions.slice(0, 8).map((d) => (
                  <li key={d.id} className="flex items-start gap-3 py-3">
                    <span
                      className={cx(
                        "mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl",
                        d.action === "accepted" ? "bg-emerald-100 text-emerald-700" : d.action === "rejected" ? "bg-rust-100 text-rust-700" : "bg-sand text-ink-soft",
                      )}
                    >
                      {d.action === "accepted" ? <Check className="size-4" /> : d.action === "rejected" ? <ThumbsDown className="size-4" /> : <Bookmark className="size-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/farmer/lots/${d.lotId}`} className="block truncate text-sm font-bold hover:underline">
                        {d.optionTitle}
                      </Link>
                      <div className="text-xs text-muted">
                        {lotName(d.lotId)} · {new Date(d.savedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold text-faint">{t("rec.decisionNote")}</div>
                    </div>
                    {d.netPerQtl !== null && <span className="tabular text-sm font-bold">{inr(d.netPerQtl)}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function AlertRow({ alert, lotLabel }: { alert: Alert; lotLabel: string }) {
  const { t } = useApp();
  const Icon = alert.kind === "buyer_demand" ? Handshake : alert.kind === "price_move" ? TrendingUp : alert.kind === "arrivals" ? Truck : TriangleAlert;
  const tone = alert.kind === "stale_data" ? "bg-rust-100 text-rust-700" : alert.kind === "buyer_demand" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
  return (
    <li>
      <Link href={`/farmer/lots/${alert.lotId}`} className="flex gap-3 rounded-xl p-2 -m-2 hover:bg-sand/60">
        <span className={cx("grid size-8 shrink-0 place-items-center rounded-xl", tone)}>
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-snug text-ink-soft">{t(`alert.${alert.kind}` as StringKey, alert.params)}</span>
          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <DataKindBadge kind={alert.dataKind} className="py-0.5!" />
            {lotLabel}
          </span>
        </span>
      </Link>
    </li>
  );
}

function LotCard({ lot, onRemove }: { lot: ProduceLot; onRemove?: () => void }) {
  const { t, lang, metrics } = useApp();
  const c = COMMODITIES[lot.commodityId];
  const Icon = CROP_ICON[lot.commodityId];
  const m = metrics.byLot[lot.id];
  const origin = resolveOrigin(lot);
  return (
    <Card className="group flex flex-col p-4 transition-shadow hover:shadow-[var(--shadow-lift)]">
      <div className="flex items-start gap-3">
        <span className={cx("grid size-11 shrink-0 place-items-center rounded-2xl", lot.commodityId === "orange" ? "bg-amber-100 text-amber-700" : "bg-sage-100 text-forest-700")}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-lg font-semibold">{c.name[lang]}</span>
            {lot.scenarioId && <Badge tone="dark">{lot.scenarioId}</Badge>}
          </div>
          <div className="tabular text-sm text-muted">
            {lot.quantityQtl} {t("common.qtl")} · {getGrade(lot.commodityId, lot.gradeId).label[lang]}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" />
          {origin.label}
        </span>
        <span>{t("farmer.harvested", { date: lot.harvestDate })}</span>
      </div>
      {m && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <Badge tone={m.status === "confident" ? "green" : m.status === "tentative" ? "amber" : "rust"}>{t(`rec.status.${m.status}`).split(" — ")[0]}</Badge>
          {m.diffPerQtl !== null && <span className="tabular text-muted">+{inr(m.diffPerQtl)}/qtl vs #2</span>}
        </div>
      )}
      <div className="mt-4 flex items-center justify-between gap-2">
        <ButtonLink href={`/farmer/lots/${lot.id}`} size="sm">
          {t("farmer.view")} <ArrowRight className="size-3.5" />
        </ButtonLink>
        {onRemove && (
          <Button size="sm" variant="ghost" onClick={onRemove} aria-label={`${t("farmer.remove")} ${c.name.en}`}>
            <Trash2 className="size-3.5" /> {t("farmer.remove")}
          </Button>
        )}
      </div>
    </Card>
  );
}
