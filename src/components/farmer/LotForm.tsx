"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, LocateFixed, MapPin, RotateCcw, Save } from "lucide-react";
import type { CommodityId, GradeStatus, ProduceLot, RiskPreference } from "@/lib/domain/types";
import { COMMODITIES, COMMODITY_LIST } from "@/lib/data/commodities";
import { DEMO_LOCATIONS } from "@/lib/data/markets";
import { addDays, dateOnly } from "@/lib/domain/dates";
import { lotSchema } from "@/lib/schemas";
import type { StringKey } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";
import { Badge, Button, Card, Notice, Segmented, Skeleton, cx } from "@/components/ui/primitives";
import { CROP_ICON } from "@/components/farmer/cropIcon";

const DRAFT_KEY = "netbhav:draft";

interface Draft {
  step: number;
  commodityId: CommodityId;
  variety: string;
  quantity: string;
  gradeId: string;
  gradeStatus: GradeStatus;
  locationId: string | null;
  custom: { lat: number; lng: number; label: string } | null;
  harvestDate: string;
  availableFrom: string;
  radiusKm: number;
  storageDays: number;
  reserve: string;
  cash: string;
  risk: RiskPreference;
  notes: string;
}

function freshDraft(today: string): Draft {
  return {
    step: 0,
    commodityId: "soybean",
    variety: COMMODITIES.soybean.varieties[0],
    quantity: "",
    gradeId: "FAQ",
    gradeStatus: "declared",
    locationId: null,
    custom: null,
    harvestDate: addDays(today, -3),
    availableFrom: today,
    radiusKm: 100,
    storageDays: 60,
    reserve: "",
    cash: "",
    risk: "balanced",
    notes: "",
  };
}

type Errors = Partial<Record<"quantity" | "location" | "dates" | "reserve" | "cash", StringKey>>;

function validateStep(d: Draft, step: number): Errors {
  const e: Errors = {};
  if (step >= 1) {
    const q = Number(d.quantity);
    if (!d.quantity.trim() || !Number.isFinite(q) || q <= 0 || q > 5000) e.quantity = "err.quantity";
  }
  if (step >= 2) {
    if (!d.locationId && !d.custom) e.location = "err.location";
    if (!d.harvestDate || !d.availableFrom) e.dates = "err.date";
    else if (d.availableFrom < d.harvestDate) e.dates = "err.dates";
  }
  if (step >= 3) {
    if (d.reserve.trim() && !(Number(d.reserve) > 0)) e.reserve = "err.reserve";
    if (d.cash.trim() && !(Number.isInteger(Number(d.cash)) && Number(d.cash) >= 0)) e.cash = "err.reserve";
  }
  return e;
}

const STEP_FIELDS: (keyof Errors)[][] = [[], ["quantity"], ["location", "dates"], ["reserve", "cash"]];

export function LotForm() {
  const { t, lang, hydrated, now, addLot } = useApp();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    let d = freshDraft(dateOnly(now));
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) d = { ...d, ...(JSON.parse(raw) as Partial<Draft>) };
    } catch {
      /* ignore unreadable draft */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(d);
  }, [hydrated, now]);

  useEffect(() => {
    if (!draft) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* session storage unavailable */
    }
  }, [draft]);

  if (!draft) return <Skeleton className="h-[520px]" />;

  const c = COMMODITIES[draft.commodityId];
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d!, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) {
        if (k === "quantity") delete next.quantity;
        if (k === "locationId" || k === "custom") delete next.location;
        if (k === "harvestDate" || k === "availableFrom") delete next.dates;
        if (k === "reserve") delete next.reserve;
        if (k === "cash") delete next.cash;
      }
      return next;
    });
  };

  const steps: StringKey[] = ["form.s1", "form.s2", "form.s3", "form.s4"];

  const next = () => {
    const e = validateStep(draft, draft.step);
    const relevant = Object.fromEntries(Object.entries(e).filter(([k]) => STEP_FIELDS[draft.step].includes(k as keyof Errors)));
    setErrors(relevant);
    if (Object.keys(relevant).length) return;
    set({ step: draft.step + 1 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = () => {
    const e = validateStep(draft, 3);
    setErrors(e);
    if (Object.keys(e).length) {
      const firstBad = STEP_FIELDS.findIndex((fields) => fields.some((f) => e[f]));
      if (firstBad >= 0) set({ step: firstBad });
      return;
    }
    const lot: ProduceLot = {
      id: `lot-${Date.now().toString(36)}`,
      createdAt: new Date().toISOString(),
      commodityId: draft.commodityId,
      variety: draft.variety,
      quantityQtl: Number(draft.quantity),
      gradeId: draft.gradeId,
      gradeStatus: draft.gradeStatus,
      locationId: draft.custom ? null : draft.locationId,
      customLocation: draft.custom,
      harvestDate: draft.harvestDate,
      availableFrom: draft.availableFrom,
      radiusKm: draft.radiusKm,
      storageDays: c.storage.suitable ? draft.storageDays : 0,
      reservePricePerQtl: draft.reserve.trim() ? Math.round(Number(draft.reserve)) : null,
      cashNeededWithinDays: draft.cash.trim() ? Number(draft.cash) : null,
      riskPreference: draft.risk,
      notes: draft.notes,
      scenarioId: null,
    };
    const parsed = lotSchema.safeParse(lot);
    if (!parsed.success) {
      setSubmitError(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      return;
    }
    addLot(lot);
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    router.push(`/farmer/lots/${lot.id}`);
  };

  const locateMe = () => {
    if (!("geolocation" in navigator)) {
      setLocError(true);
      return;
    }
    setLocating(true);
    setLocError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        // The demo only has market data for the Nagpur region.
        if (lat < 19 || lat > 23 || lng < 76 || lng > 81) {
          setLocError(true);
          return;
        }
        set({ custom: { lat: Math.round(lat * 1000) / 1000, lng: Math.round(lng * 1000) / 1000, label: t("form.myLocation") }, locationId: null });
      },
      () => {
        setLocating(false);
        setLocError(true);
      },
      { timeout: 8000, maximumAge: 600000 },
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card className="p-5 md:p-8">
        {/* Stepper */}
        <ol className="mb-8 grid grid-cols-4 gap-2" aria-label={t("form.step", { n: draft.step + 1, total: 4 })}>
          {steps.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                disabled={i > draft.step}
                onClick={() => set({ step: i })}
                className="group w-full cursor-pointer text-left disabled:cursor-default"
                aria-current={i === draft.step ? "step" : undefined}
              >
                <span className={cx("block h-1.5 rounded-full transition-colors", i < draft.step ? "bg-emerald-500" : i === draft.step ? "bg-forest-800" : "bg-sand")} />
                <span className={cx("mt-2 hidden text-xs font-bold sm:block", i === draft.step ? "text-ink" : "text-faint")}>
                  {i + 1}. {t(s)}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">{t("form.step", { n: draft.step + 1, total: 4 })}</div>
        <h2 className="mb-6 font-display text-2xl font-semibold">{t(steps[draft.step])}</h2>

        <div key={draft.step} className="animate-rise space-y-6">
          {draft.step === 0 && (
            <>
              <fieldset>
                <legend className="label">{t("form.crop")}</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {COMMODITY_LIST.map((cm) => {
                    const Icon = CROP_ICON[cm.id];
                    const active = draft.commodityId === cm.id;
                    return (
                      <button
                        key={cm.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => set({ commodityId: cm.id, variety: cm.varieties[0], gradeId: cm.defaultGradeId, storageDays: cm.storage.suitable ? 60 : 0 })}
                        className={cx(
                          "flex cursor-pointer flex-col items-start rounded-2xl border-2 p-4 text-left transition-all",
                          active ? "border-emerald-500 bg-emerald-50 shadow-[0_0_0_4px_rgb(22_160_102/0.1)]" : "border-line bg-paper hover:border-line-strong",
                        )}
                      >
                        <span className={cx("mb-3 grid size-11 place-items-center rounded-2xl", active ? "bg-emerald-600 text-white" : "bg-sand text-ink-soft")}>
                          <Icon className="size-5" />
                        </span>
                        <span className="font-display text-lg font-semibold">{cm.name[lang]}</span>
                        <Badge tone={cm.cropClass === "perishable" ? "amber" : "neutral"} className="mt-2">
                          {t(`class.${cm.cropClass}`)}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <Notice tone="sky">{c.hint[lang]}</Notice>
              <label className="block">
                <span className="label">{t("form.variety")}</span>
                <select className="input" value={draft.variety} onChange={(e) => set({ variety: e.target.value })}>
                  {c.varieties.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          {draft.step === 1 && (
            <>
              <div>
                <label className="label" htmlFor="qty">
                  {t("form.quantity")}
                </label>
                <div className="flex items-stretch gap-2">
                  <input
                    id="qty"
                    className="input tabular max-w-[220px] text-xl! font-bold"
                    inputMode="decimal"
                    type="number"
                    min={0.1}
                    step="0.1"
                    placeholder="0"
                    value={draft.quantity}
                    aria-invalid={!!errors.quantity}
                    aria-describedby="qty-hint"
                    onChange={(e) => set({ quantity: e.target.value })}
                  />
                  <span className="grid place-items-center rounded-xl bg-sand px-4 text-sm font-bold text-ink-soft">{t("form.qtl")}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[5, 10, 25, 40, 60, 100].map((q) => (
                    <button key={q} type="button" onClick={() => set({ quantity: String(q) })} className="min-h-9 cursor-pointer rounded-xl border border-line bg-paper px-3 text-sm font-bold hover:border-forest-600">
                      {q}
                    </button>
                  ))}
                </div>
                <p id="qty-hint" className={cx("mt-2 text-xs", errors.quantity ? "font-bold text-rust-600" : "text-muted")}>
                  {errors.quantity ? t(errors.quantity) : t("form.quantityHint")}
                </p>
              </div>
              <fieldset>
                <legend className="label">{t("form.grade")}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {c.grades.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={draft.gradeId === g.id}
                      onClick={() => set({ gradeId: g.id })}
                      className={cx(
                        "cursor-pointer rounded-2xl border-2 p-3 text-left transition-colors",
                        draft.gradeId === g.id ? "border-emerald-500 bg-emerald-50" : "border-line bg-paper hover:border-line-strong",
                      )}
                    >
                      <span className="block font-bold">{g.label[lang]}</span>
                      <span className="mt-0.5 block text-xs text-muted">{g.description[lang]}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <span className="label">{t("form.gradeStatus")}</span>
                <Segmented<GradeStatus>
                  label={t("form.gradeStatus")}
                  value={draft.gradeStatus}
                  onChange={(v) => set({ gradeStatus: v })}
                  options={[
                    { value: "verified", label: t("gs.verified") },
                    { value: "declared", label: t("gs.declared") },
                    { value: "unknown", label: t("gs.unknown") },
                  ]}
                />
              </div>
              <label className="block">
                <span className="label">{t("form.notes")}</span>
                <textarea className="input min-h-20" maxLength={500} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
              </label>
            </>
          )}

          {draft.step === 2 && (
            <>
              <fieldset>
                <legend className="label">{t("form.location")}</legend>
                <Button type="button" variant="secondary" onClick={locateMe} disabled={locating} className="mb-2">
                  <LocateFixed className="size-4" /> {locating ? t("form.locating") : t("form.useMyLocation")}
                </Button>
                <p className="mb-3 text-xs text-muted">{t("form.locationConsent")}</p>
                {locError && <p className="mb-3 text-xs font-bold text-rust-600">{t("form.locationDenied")}</p>}
                {draft.custom && (
                  <div className="mb-3 flex items-center gap-2 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-3 text-sm font-bold">
                    <MapPin className="size-4 text-emerald-600" /> {draft.custom.label} ({draft.custom.lat}, {draft.custom.lng})
                    <button type="button" className="ml-auto cursor-pointer text-xs text-muted underline" onClick={() => set({ custom: null })}>
                      {t("common.cancel")}
                    </button>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  {DEMO_LOCATIONS.map((l) => {
                    const active = !draft.custom && draft.locationId === l.id;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => set({ locationId: l.id, custom: null })}
                        className={cx(
                          "flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-left text-sm transition-colors",
                          active ? "border-emerald-500 bg-emerald-50 font-bold" : "border-line bg-paper hover:border-line-strong",
                        )}
                      >
                        <MapPin className={cx("size-4", active ? "text-emerald-600" : "text-faint")} />
                        <span>
                          {l.name} <span className="text-xs text-muted">· {l.district}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.location && <p className="mt-2 text-xs font-bold text-rust-600">{t(errors.location)}</p>}
              </fieldset>
              <div>
                <label className="label" htmlFor="radius">
                  {t("form.radius")} <span className="tabular text-emerald-700">{draft.radiusKm} km</span>
                </label>
                <input id="radius" type="range" min={20} max={250} step={10} value={draft.radiusKm} onChange={(e) => set({ radiusKm: Number(e.target.value) })} className="w-full accent-emerald-600" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">{t("form.harvestDate")}</span>
                  <input type="date" className="input" value={draft.harvestDate} max={dateOnly(now)} aria-invalid={!!errors.dates} onChange={(e) => set({ harvestDate: e.target.value })} />
                </label>
                <label className="block">
                  <span className="label">{t("form.availableFrom")}</span>
                  <input type="date" className="input" value={draft.availableFrom} aria-invalid={!!errors.dates} onChange={(e) => set({ availableFrom: e.target.value })} />
                </label>
              </div>
              {errors.dates && <p className="text-xs font-bold text-rust-600">{t(errors.dates)}</p>}
              {c.shelfLifeDays !== null && <Notice tone="amber">{t("form.shelfLife", { days: c.shelfLifeDays })}</Notice>}
            </>
          )}

          {draft.step === 3 && (
            <>
              {c.storage.suitable ? (
                <div>
                  <span className="label">{t("form.storageDays")}</span>
                  <Segmented<string>
                    label={t("form.storageDays")}
                    value={String(draft.storageDays)}
                    onChange={(v) => set({ storageDays: Number(v) })}
                    options={[30, 60, 90, 120].map((d) => ({ value: String(d), label: `${d} ${t("form.days")}` }))}
                  />
                  <p className="mt-2 text-xs text-muted">{t("form.storable")}</p>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">{t("form.reserve")}</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-muted">₹</span>
                    <input className="input tabular pl-8!" type="number" inputMode="numeric" min={1} value={draft.reserve} aria-invalid={!!errors.reserve} onChange={(e) => set({ reserve: e.target.value })} placeholder="/qtl" />
                  </div>
                  <span className={cx("mt-1 block text-xs", errors.reserve ? "font-bold text-rust-600" : "text-muted")}>{errors.reserve ? t(errors.reserve) : t("form.reserveHint")}</span>
                </label>
                <label className="block">
                  <span className="label">{t("form.cash")}</span>
                  <div className="flex gap-2">
                    <input className="input tabular" type="number" inputMode="numeric" min={0} value={draft.cash} aria-invalid={!!errors.cash} onChange={(e) => set({ cash: e.target.value })} />
                    <span className="grid place-items-center rounded-xl bg-sand px-3 text-sm font-bold text-ink-soft">{t("form.days")}</span>
                  </div>
                  <span className={cx("mt-1 block text-xs", errors.cash ? "font-bold text-rust-600" : "text-muted")}>{errors.cash ? t(errors.cash) : t("form.cashHint")}</span>
                </label>
              </div>
              <fieldset>
                <legend className="label">{t("form.risk")}</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {(["cautious", "balanced", "patient"] as RiskPreference[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={draft.risk === r}
                      onClick={() => set({ risk: r })}
                      className={cx(
                        "cursor-pointer rounded-2xl border-2 p-3 text-left transition-colors",
                        draft.risk === r ? "border-emerald-500 bg-emerald-50" : "border-line bg-paper hover:border-line-strong",
                      )}
                    >
                      <span className="block font-bold">{t(`risk.${r}`)}</span>
                      <span className="block text-xs text-muted">{t(`risk.${r}Desc`)}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              {submitError && (
                <Notice tone="rust">
                  {submitError}
                </Notice>
              )}
            </>
          )}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <Button type="button" variant="ghost" onClick={() => set({ step: Math.max(0, draft.step - 1) })} disabled={draft.step === 0}>
            <ArrowLeft className="size-4" /> {t("form.back")}
          </Button>
          {draft.step < 3 ? (
            <Button type="button" size="lg" onClick={next}>
              {t("form.next")} <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" size="lg" onClick={submit}>
              <Check className="size-4" /> {t("form.submit")}
            </Button>
          )}
        </div>
      </Card>

      <aside className="space-y-4">
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-faint">
            <Save className="size-3.5" /> {t("form.draftKept")}
          </div>
          <dl className="space-y-2 text-sm">
            <Row k={t("form.s1")} v={`${c.name[lang]} · ${draft.variety}`} />
            <Row k={t("form.quantity")} v={draft.quantity ? `${draft.quantity} ${t("common.qtl")}` : "—"} />
            <Row k={t("form.grade")} v={`${c.grades.find((g) => g.id === draft.gradeId)?.label[lang] ?? "—"} · ${t(`gs.${draft.gradeStatus}`)}`} />
            <Row k={t("form.location")} v={draft.custom?.label ?? DEMO_LOCATIONS.find((l) => l.id === draft.locationId)?.name ?? "—"} />
            <Row k={t("form.radius")} v={`${draft.radiusKm} km`} />
            <Row k={t("form.risk")} v={t(`risk.${draft.risk}`)} />
          </dl>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="mt-4"
            onClick={() => {
              setDraft(freshDraft(dateOnly(now)));
              setErrors({});
            }}
          >
            <RotateCcw className="size-3.5" /> {t("form.reset")}
          </Button>
        </Card>
      </aside>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right font-semibold">{v}</dd>
    </div>
  );
}
