"use client";

import { useState } from "react";
import { Info, Truck, Users } from "lucide-react";
import type { CommodityId } from "@/lib/domain/types";
import { seedFpos } from "@/lib/data/actors";
import { COMMODITIES } from "@/lib/data/commodities";
import { MARKETS } from "@/lib/data/markets";
import { compareAggregation } from "@/lib/engine/fpo";
import { describeTransport } from "@/lib/engine/logistics";
import { inr } from "@/lib/i18n";
import { PRE_HYDRATION_DATE, useApp } from "@/lib/store/AppProvider";
import { Badge, Card, DataKindBadge, Notice, PageHeader, SectionTitle, cx } from "@/components/ui/primitives";

const FPOS = seedFpos(PRE_HYDRATION_DATE);

export default function FpoPage() {
  const { t, lang, settings, allLots, hydrated } = useApp();
  const [fpoId, setFpoId] = useState(FPOS[0].id);
  const fpo = FPOS.find((f) => f.id === fpoId)!;
  const [crop, setCrop] = useState<CommodityId>(fpo.commodities[0]);
  const markets = MARKETS.filter((m) => m.commodities.includes(crop));
  const [destId, setDestId] = useState("nagpur");
  const dest = markets.find((m) => m.id === destId) ?? markets[0];
  const members = fpo.members[crop] ?? [];
  const [excluded, setExcluded] = useState<string[]>([]);
  const [myLotId, setMyLotId] = useState<string>("");
  const [fee, setFee] = useState(fpo.serviceFeePerQtl);
  const [collection, setCollection] = useState(fpo.collectionPerQtl);
  const [offset, setOffset] = useState(5);

  const myLots = hydrated ? allLots.filter((l) => l.commodityId === crop) : [];
  const myLot = myLots.find((l) => l.id === myLotId);

  const chooseFpo = (id: string) => {
    const f = FPOS.find((x) => x.id === id)!;
    setFpoId(id);
    setCrop(f.commodities[0]);
    setFee(f.serviceFeePerQtl);
    setCollection(f.collectionPerQtl);
    setExcluded([]);
    setMyLotId("");
  };

  const result = (() => {
    const list = members.filter((m) => !excluded.includes(m.id)).map((m) => ({ id: m.id, label: m.farmerLabel, quantityQtl: m.quantityQtl }));
    if (myLot) list.unshift({ id: myLot.id, label: `${t("buyer.yourLot")} (${myLot.quantityQtl} qtl)`, quantityQtl: myLot.quantityQtl });
    return compareAggregation({
      fpo,
      members: list,
      destination: dest,
      vehicles: settings.vehicles,
      roadFactor: settings.roadFactor,
      serviceFeePerQtl: fee,
      collectionPerQtl: collection,
      memberOffsetKm: offset,
    });
  })();

  const maxPerQtl = Math.max(1, ...result.members.map((m) => Math.max(m.alonePerQtl, m.pooledPerQtl)));

  return (
    <div>
      <PageHeader eyebrow={t("role.fpo")} title={t("fpo.title")} sub={t("fpo.sub")} action={<DataKindBadge kind="demo" />} />
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="space-y-5 p-5">
          <label className="block">
            <span className="label">{t("fpo.choose")}</span>
            <select className="input" value={fpoId} onChange={(e) => chooseFpo(e.target.value)}>
              {FPOS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">{t("fpo.crop")}</span>
              <select
                className="input"
                value={crop}
                onChange={(e) => {
                  setCrop(e.target.value as CommodityId);
                  setExcluded([]);
                  setMyLotId("");
                }}
              >
                {fpo.commodities.map((c) => (
                  <option key={c} value={c}>
                    {COMMODITIES[c].name[lang]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">{t("fpo.destination")}</span>
              <select className="input" value={dest.id} onChange={(e) => setDestId(e.target.value)}>
                {markets.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="label">{t("fpo.members")}</legend>
            <ul className="space-y-1.5">
              {members.map((m) => {
                const on = !excluded.includes(m.id);
                return (
                  <li key={m.id}>
                    <label className={cx("flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3", on ? "border-emerald-300 bg-emerald-50" : "border-line bg-paper")}>
                      <input
                        type="checkbox"
                        className="size-4 accent-emerald-600"
                        checked={on}
                        onChange={() => setExcluded((x) => (on ? [...x, m.id] : x.filter((id) => id !== m.id)))}
                      />
                      <span className="flex-1 text-sm">
                        <b>{m.farmerLabel}</b> <span className="text-xs text-muted">· {m.locationName}</span>
                      </span>
                      <span className="tabular text-sm font-bold">{m.quantityQtl} qtl</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <label className="mt-3 block">
              <span className="label">{t("fpo.addYou")}</span>
              <select className="input" value={myLotId} onChange={(e) => setMyLotId(e.target.value)}>
                <option value="">—</option>
                {myLots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {COMMODITIES[l.commodityId].name[lang]} · {l.quantityQtl} qtl {l.scenarioId ? `(Scenario ${l.scenarioId})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <fieldset className="space-y-3 border-t border-line pt-4">
            <legend className="label">{t("fpo.assumptions")}</legend>
            <NumberField label={t("fpo.fee")} value={fee} onChange={setFee} />
            <NumberField label={t("fpo.collection")} value={collection} onChange={setCollection} />
            <NumberField label={t("fpo.offset")} value={offset} onChange={setOffset} />
          </fieldset>
        </Card>

        <div className="space-y-6">
          {result.members.length === 0 ? (
            <Notice>{t("fpo.noMembers")}</Notice>
          ) : (
            <>
              <div className="panel-dark grain grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-4">
                <Tile label={t("fpo.pooled")} value={`${result.pooledQty} qtl`} sub={`${dest.name} · ${result.km} km`} />
                <Tile label={`${t("fpo.alone")} · ${t("fpo.perQtl")}`} value={inr(result.avgAlonePerQtl)} sub="avg. freight per qtl" />
                <Tile label={`${t("fpo.pooled")} · ${t("fpo.perQtl")}`} value={inr(result.avgPooledPerQtl)} sub="freight + collection + fee" accent />
                <Tile label={t("fpo.totalSaving")} value={inr(result.totalSaving)} sub="estimate, all members" accent />
              </div>

              <Card className="p-5">
                <SectionTitle title={t("fpo.perQtl")} icon={<Users className="size-5 text-emerald-600" />} />
                <div className="mb-3 flex gap-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-5 rounded-full bg-amber-500" /> {t("fpo.alone")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-5 rounded-full bg-emerald-500" /> {t("fpo.pooled")}
                  </span>
                </div>
                <div className="space-y-4">
                  {result.members.map((m) => (
                    <div key={m.id} className="grid grid-cols-[minmax(0,32%)_1fr] gap-3 sm:grid-cols-[minmax(0,26%)_1fr_120px]">
                      <div className="min-w-0 text-sm">
                        <div className="truncate font-bold">{m.label}</div>
                        <div className="text-xs text-muted">{m.quantityQtl} qtl</div>
                      </div>
                      <div className="space-y-1.5">
                        <Bar pct={(m.alonePerQtl / maxPerQtl) * 100} color="bg-amber-500" value={inr(m.alonePerQtl)} />
                        <Bar pct={(m.pooledPerQtl / maxPerQtl) * 100} color="bg-emerald-500" value={inr(m.pooledPerQtl)} />
                      </div>
                      <div className={cx("tabular col-start-2 text-right text-sm font-extrabold sm:col-start-auto", m.savingPerQtl >= 0 ? "text-emerald-700" : "text-rust-600")}>
                        {m.savingPerQtl >= 0 ? "+" : "−"}
                        {inr(Math.abs(m.savingPerQtl))}/qtl
                        <div className="text-xs font-semibold text-muted">{inr(m.savingTotal)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle title={t("fpo.vehicles")} icon={<Truck className="size-5 text-amber-600" />} />
                {result.pooled && <p className="text-sm text-ink-soft">{describeTransport(result.pooled)}</p>}
                <ul className="mt-3 space-y-1 text-xs text-muted">
                  {result.members.map((m) => (
                    <li key={m.id}>
                      <b className="text-ink-soft">{m.label}:</b> {describeTransport(m.alone)}
                    </li>
                  ))}
                </ul>
              </Card>
              <Notice tone="sky" icon={<Info className="size-4" />}>
                {t("fpo.note")} <Badge tone="outline">{fpo.name}</Badge>
              </Notice>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-sage-300">{label}</div>
      <div className={cx("tabular mt-1 font-display text-3xl font-semibold", accent ? "text-emerald-300" : "text-white")}>{value}</div>
      <div className="text-xs text-sage-400">{sub}</div>
    </div>
  );
}

function Bar({ pct, color, value }: { pct: number; color: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 flex-1 overflow-hidden rounded-full bg-sand/70">
        <div className={cx("h-full origin-left rounded-full animate-grow", color)} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      <span className="tabular w-14 text-right text-xs font-bold text-ink-soft">{value}</span>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-soft">{label}</span>
      <input
        type="number"
        min={0}
        className="input tabular min-h-10! w-24 text-right"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
      />
    </label>
  );
}
