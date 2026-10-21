"use client";

import { useState } from "react";
import { Check, Filter, Handshake, MapPin, Plus, Trash2, X } from "lucide-react";
import type { BuyerDemand, CommodityId, GradeStatus } from "@/lib/domain/types";
import { seedBuyerDemands } from "@/lib/data/actors";
import { COMMODITIES, COMMODITY_LIST, getGrade } from "@/lib/data/commodities";
import { DEMO_LOCATIONS, LOCATION_BY_ID } from "@/lib/data/markets";
import { addDays, dateOnly } from "@/lib/domain/dates";
import { resolveOrigin } from "@/lib/engine/recommend";
import { roadKm } from "@/lib/engine/logistics";
import { buyerDemandSchema } from "@/lib/schemas";
import { inr } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";
import { Badge, Button, Card, DataKindBadge, EmptyState, Notice, PageHeader, SectionTitle, Skeleton, cx } from "@/components/ui/primitives";

/** Simulated lots from other (fictional) farmers, so buyers have something to match against. */
const SIM_LOTS: { id: string; commodityId: CommodityId; quantityQtl: number; gradeId: string; gradeStatus: GradeStatus; locationId: string }[] = [
  { id: "sim-1", commodityId: "orange", quantityQtl: 45, gradeId: "A", gradeStatus: "verified", locationId: "narkhed-area" },
  { id: "sim-2", commodityId: "orange", quantityQtl: 30, gradeId: "C", gradeStatus: "declared", locationId: "kalmeshwar-area" },
  { id: "sim-3", commodityId: "soybean", quantityQtl: 120, gradeId: "FAQ", gradeStatus: "verified", locationId: "seloo" },
  { id: "sim-4", commodityId: "soybean", quantityQtl: 18, gradeId: "BFAQ", gradeStatus: "declared", locationId: "hingna-area" },
  { id: "sim-5", commodityId: "tur", quantityQtl: 35, gradeId: "FAQ", gradeStatus: "declared", locationId: "hinganghat-area" },
];

interface Row {
  id: string;
  commodityId: CommodityId;
  quantityQtl: number;
  gradeId: string;
  gradeStatus: GradeStatus;
  origin: { lat: number; lng: number; label: string };
  simulated: boolean;
}

export default function BuyerPage() {
  const { t, lang, hydrated, now, buyerPosts, removeBuyerPost, allLots, settings } = useApp();
  const seeded = hydrated ? seedBuyerDemands(now) : [];
  const posts = [...buyerPosts, ...seeded];
  const [selected, setSelected] = useState<string>("bd-oilmill");
  const [showForm, setShowForm] = useState(false);
  const [crop, setCrop] = useState<CommodityId | "all">("all");
  const [minQty, setMinQty] = useState(0);
  const [maxKm, setMaxKm] = useState(150);

  const demand = posts.find((p) => p.id === selected) ?? posts[0];

  const rows: Row[] = (() => {
    const own = allLots.map((l) => ({ id: l.id, commodityId: l.commodityId, quantityQtl: l.quantityQtl, gradeId: l.gradeId, gradeStatus: l.gradeStatus, origin: resolveOrigin(l), simulated: false }));
    const sim = SIM_LOTS.map((s) => {
      const loc = LOCATION_BY_ID[s.locationId];
      return { ...s, origin: { lat: loc.lat, lng: loc.lng, label: loc.name }, simulated: true };
    });
    return [...own, ...sim];
  })();

  const matches = (() => {
    if (!demand) return [];
    return rows
      .map((r) => ({ ...r, km: roadKm(r.origin, demand, settings.roadFactor) }))
      .filter(
        (r) =>
          r.commodityId === demand.commodityId &&
          (crop === "all" || r.commodityId === crop) &&
          r.quantityQtl >= Math.max(minQty, demand.minQtl) &&
          r.quantityQtl <= demand.maxQtl &&
          r.km <= maxKm &&
          (r.gradeStatus === "unknown" || demand.acceptedGradeIds.includes(r.gradeId)),
      )
      .sort((a, b) => a.km - b.km);
  })();

  if (!hydrated) return <Skeleton className="h-96" />;

  const visiblePosts = posts.filter((p) => crop === "all" || p.commodityId === crop);

  return (
    <div>
      <PageHeader
        eyebrow={t("role.buyer")}
        title={t("buyer.title")}
        sub={t("buyer.sub")}
        action={
          <Button onClick={() => setShowForm((s) => !s)} variant={showForm ? "secondary" : "primary"}>
            {showForm ? <X className="size-4" /> : <Plus className="size-4" />} {t("buyer.post")}
          </Button>
        }
      />
      {showForm && <DemandForm onDone={(id) => { setShowForm(false); if (id) setSelected(id); }} />}

      <Card className="mb-6 flex flex-wrap items-end gap-4 p-4">
        <span className="flex items-center gap-1.5 self-center text-xs font-bold uppercase tracking-wide text-faint">
          <Filter className="size-3.5" /> {t("buyer.filters")}
        </span>
        <label>
          <span className="label">{t("fpo.crop")}</span>
          <select className="input min-h-10!" value={crop} onChange={(e) => setCrop(e.target.value as CommodityId | "all")}>
            <option value="all">{t("buyer.allCrops")}</option>
            {COMMODITY_LIST.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name[lang]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">{t("buyer.minQty")}</span>
          <input type="number" min={0} className="input tabular min-h-10! w-28" value={minQty} onChange={(e) => setMinQty(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <label className="min-w-[200px] flex-1">
          <span className="label">
            {t("buyer.maxKm")}: <span className="tabular text-emerald-700">{maxKm} km</span>
          </span>
          <input type="range" min={20} max={300} step={10} value={maxKm} onChange={(e) => setMaxKm(Number(e.target.value))} className="w-full accent-emerald-600" />
        </label>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section>
          <SectionTitle title={t("buyer.posts")} icon={<Handshake className="size-5 text-emerald-600" />} />
          <div className="space-y-3">
            {visiblePosts.map((p) => (
              <div
                key={p.id}
                className={cx(
                  "card p-4 transition-all",
                  demand?.id === p.id ? "border-emerald-500! shadow-[0_0_0_3px_rgb(22_160_102/0.12)]" : "hover:border-line-strong",
                )}
              >
                <button type="button" onClick={() => setSelected(p.id)} aria-pressed={demand?.id === p.id} className="flex w-full cursor-pointer items-start justify-between gap-3 text-left">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {p.createdInDemo ? <Badge tone="sky">{t("buyer.yours")}</Badge> : <DataKindBadge kind="demo" />}
                      <Badge>{COMMODITIES[p.commodityId].name[lang]}</Badge>
                    </div>
                    <div className="mt-1.5 font-display text-lg font-semibold">{p.buyerName}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" /> {p.locationName}
                      </span>
                      <span>
                        {p.minQtl}–{p.maxQtl} qtl
                      </span>
                      <span>{p.acceptedGradeIds.map((g) => getGrade(p.commodityId, g).label[lang]).join(", ")}</span>
                      <span>{p.terms === "farm_gate" ? t("buyer.farmGate") : t("buyer.delivered")}</span>
                      <span>
                        {t("buyer.payment")}: {p.paymentDays}
                      </span>
                      <span>
                        {t("buyer.requiredBy")}: {p.requiredBy}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="tabular font-display text-xl font-semibold text-emerald-700">{inr(p.pricePerQtl)}</div>
                    <div className="text-[11px] text-muted">/qtl</div>
                    <Badge tone={p.reliability === "High" ? "green" : p.reliability === "Medium" ? "amber" : "rust"} className="mt-1">
                      {p.reliability}
                    </Badge>
                  </div>
                </button>
                {p.createdInDemo && (
                  <button type="button" onClick={() => removeBuyerPost(p.id)} className="mt-3 inline-flex min-h-9 cursor-pointer items-center gap-1 text-xs font-bold text-rust-600 hover:underline">
                    <Trash2 className="size-3.5" /> {t("buyer.remove")}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle title={t("buyer.matching")} sub={demand ? `${demand.buyerName} · ${COMMODITIES[demand.commodityId].name[lang]}` : undefined} />
          {matches.length === 0 ? (
            <EmptyState icon={<Filter className="size-5" />} title={t("buyer.noMatches")} />
          ) : (
            <Card className="divide-y divide-line">
              {matches.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold">
                        {COMMODITIES[m.commodityId].name[lang]} · {m.quantityQtl} qtl
                      </span>
                      {m.simulated ? <Badge tone="outline">{t("buyer.otherFarmers")}</Badge> : <Badge tone="sky">{t("buyer.yourLot")}</Badge>}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">
                      {getGrade(m.commodityId, m.gradeId).label[lang]} · {t(`gs.${m.gradeStatus}`)} · {m.origin.label}
                    </div>
                  </div>
                  <span className="tabular shrink-0 text-sm font-bold text-ink-soft">{Math.round(m.km)} km</span>
                </div>
              ))}
            </Card>
          )}
          <Notice className="mt-4" tone="sky">
            {t("buyer.note")}
          </Notice>
        </section>
      </div>
    </div>
  );
}

function DemandForm({ onDone }: { onDone: (id: string | null) => void }) {
  const { t, lang, now, addBuyerPost } = useApp();
  const [f, setF] = useState({
    buyerName: "",
    buyerType: "processor" as BuyerDemand["buyerType"],
    commodityId: "soybean" as CommodityId,
    grades: ["FAQ"],
    minQtl: "20",
    maxQtl: "200",
    price: "",
    terms: "delivered" as BuyerDemand["terms"],
    locationId: "hingna-area",
    paymentDays: "7",
    requiredBy: addDays(dateOnly(now), 10),
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const c = COMMODITIES[f.commodityId];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const loc = LOCATION_BY_ID[f.locationId];
    const minQ = Number(f.minQtl);
    const maxQ = Number(f.maxQtl);
    const errs: string[] = [];
    if (!(Number(f.price) > 0)) errs.push(t("buyer.price"));
    if (!(minQ > 0) || !(maxQ >= minQ)) errs.push(t("buyer.qtyRange"));
    const post: BuyerDemand = {
      id: `bp-${Date.now().toString(36)}`,
      buyerName: f.buyerName.trim() ? `${f.buyerName.trim()} (simulated)` : "",
      buyerType: f.buyerType,
      commodityId: f.commodityId,
      acceptedGradeIds: f.grades,
      minQtl: minQ,
      maxQtl: maxQ,
      pricePerQtl: Number(f.price),
      terms: f.terms,
      lat: loc.lat,
      lng: loc.lng,
      locationName: loc.name,
      paymentDays: Number(f.paymentDays),
      reliability: "Medium",
      requiredBy: f.requiredBy,
      postedAt: new Date().toISOString(),
      provenance: { sourceId: "buyer-posts", sourceName: "Simulated buyer postings", kind: "demo", observedAt: new Date().toISOString(), status: "ok" },
      createdInDemo: true,
    };
    const parsed = buyerDemandSchema.safeParse(post);
    if (!parsed.success) errs.push(...parsed.error.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`));
    setErrors(errs);
    if (errs.length) return;
    addBuyerPost(parsed.data as BuyerDemand);
    setDone(true);
    setTimeout(() => onDone(post.id), 900);
  };

  return (
    <Card className="mb-6 p-5 animate-rise">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
        <label className="block md:col-span-2">
          <span className="label">{t("buyer.name")}</span>
          <input className="input" maxLength={60} value={f.buyerName} onChange={(e) => setF({ ...f, buyerName: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">{t("buyer.type")}</span>
          <select className="input" value={f.buyerType} onChange={(e) => setF({ ...f, buyerType: e.target.value as BuyerDemand["buyerType"] })}>
            <option value="processor">Processor</option>
            <option value="trader">Trader</option>
            <option value="exporter">Exporter</option>
            <option value="retail_chain">Retail chain</option>
          </select>
        </label>
        <label className="block">
          <span className="label">{t("fpo.crop")}</span>
          <select
            className="input"
            value={f.commodityId}
            onChange={(e) => {
              const id = e.target.value as CommodityId;
              setF({ ...f, commodityId: id, grades: [COMMODITIES[id].defaultGradeId] });
            }}
          >
            {COMMODITY_LIST.map((cm) => (
              <option key={cm.id} value={cm.id}>
                {cm.name[lang]}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="md:col-span-2">
          <legend className="label">{t("buyer.grades")}</legend>
          <div className="flex flex-wrap gap-2">
            {c.grades.map((g) => {
              const on = f.grades.includes(g.id);
              return (
                <label key={g.id} className={cx("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm", on ? "border-emerald-400 bg-emerald-50 font-bold" : "border-line")}>
                  <input
                    type="checkbox"
                    className="accent-emerald-600"
                    checked={on}
                    onChange={() => setF({ ...f, grades: on ? f.grades.filter((x) => x !== g.id) : [...f.grades, g.id] })}
                  />
                  {g.label[lang]}
                </label>
              );
            })}
          </div>
        </fieldset>
        <label className="block">
          <span className="label">{t("buyer.price")}</span>
          <input className="input tabular" type="number" min={1} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
        </label>
        <div>
          <span className="label">{t("buyer.qtyRange")}</span>
          <div className="flex items-center gap-2">
            <input className="input tabular" type="number" min={1} value={f.minQtl} onChange={(e) => setF({ ...f, minQtl: e.target.value })} aria-label="min" />
            <span>–</span>
            <input className="input tabular" type="number" min={1} value={f.maxQtl} onChange={(e) => setF({ ...f, maxQtl: e.target.value })} aria-label="max" />
          </div>
        </div>
        <label className="block">
          <span className="label">{t("buyer.terms")}</span>
          <select className="input" value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value as BuyerDemand["terms"] })}>
            <option value="delivered">{t("buyer.delivered")}</option>
            <option value="farm_gate">{t("buyer.farmGate")}</option>
          </select>
        </label>
        <label className="block">
          <span className="label">{t("buyer.location")}</span>
          <select className="input" value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}>
            {DEMO_LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">{t("buyer.payment")}</span>
          <input className="input tabular" type="number" min={0} max={120} value={f.paymentDays} onChange={(e) => setF({ ...f, paymentDays: e.target.value })} />
        </label>
        <label className="block">
          <span className="label">{t("buyer.requiredBy")}</span>
          <input className="input" type="date" value={f.requiredBy} onChange={(e) => setF({ ...f, requiredBy: e.target.value })} />
        </label>
        <div className="flex flex-col justify-end gap-2 md:col-span-3 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted">{t("buyer.reliability")}: Medium · {t("banner.demo")}</p>
          <Button type="submit" disabled={done}>
            {done ? <Check className="size-4" /> : <Plus className="size-4" />} {t("buyer.submit")}
          </Button>
        </div>
        {errors.length > 0 && (
          <div className="md:col-span-3">
            <Notice tone="rust">{errors.join(" · ")}</Notice>
          </div>
        )}
        {done && (
          <div className="md:col-span-3">
            <Notice tone="green">{t("buyer.posted")}</Notice>
          </div>
        )}
      </form>
    </Card>
  );
}
