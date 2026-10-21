"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Check,
  CircleAlert,
  Clock,
  Database,
  Info,
  ListOrdered,
  MapPin,
  RefreshCcw,
  Scale,
  Square,
  ThumbsDown,
  TriangleAlert,
  Truck,
  Volume2,
  Warehouse,
} from "lucide-react";
import type { ProduceLot, Provenance, Recommendation, RecommendationOption, RiskPreference, SavedDecision } from "@/lib/domain/types";
import { COMMODITIES, getGrade } from "@/lib/data/commodities";
import { SCENARIO_BY_ID } from "@/lib/data/scenarios";
import { resolveOrigin } from "@/lib/engine/recommend";
import { inr, type StringKey } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";
import { useRecommendation } from "@/lib/store/useRecommendation";
import { Badge, Button, ButtonLink, Card, DataKindBadge, EmptyState, Notice, QualityBadge, SectionTitle, Segmented, Skeleton, cx } from "@/components/ui/primitives";
import { Waterfall } from "@/components/charts/Waterfall";
import { CompareBars } from "@/components/charts/CompareBars";
import { MarketMap } from "@/components/charts/MarketMap";
import { StorageChart } from "@/components/charts/StorageChart";
import { ExplanationList, useExplain } from "@/components/farmer/Explanations";
import { OptionCard } from "@/components/farmer/OptionCard";

const SPEECH_LANG = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" } as const;

export function RecommendationView({ lotId }: { lotId: string }) {
  const { getLot, hydrated, t } = useApp();
  const lot = getLot(lotId);
  const rec = useRecommendation(lot);

  if (!hydrated) return <LoadingSkeleton />;
  if (!lot) {
    return (
      <EmptyState icon={<CircleAlert className="size-5" />} title={t("rec.notFound")}>
        <ButtonLink href="/farmer" variant="secondary" className="mt-4">
          {t("rec.backToLots")}
        </ButtonLink>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-6">
      <LotBar lot={lot} updating={rec.phase === "loading" && !!rec.data} />
      {rec.phase === "error" && (
        <Notice tone="rust" icon={<TriangleAlert className="size-4" />}>
          <div className="font-bold">{t("rec.error")}</div>
          <div className="mt-0.5 text-xs opacity-80">{rec.error}</div>
          <Button size="sm" variant="secondary" className="mt-2" onClick={rec.retry}>
            <RefreshCcw className="size-3.5" /> {t("rec.retry")}
          </Button>
        </Notice>
      )}
      {!rec.data ? (
        rec.phase === "error" ? null : <LoadingSkeleton />
      ) : (
        <Result lot={lot} rec={rec.data} />
      )}
    </div>
  );
}

function LoadingSkeleton() {
  const { t } = useApp();
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="panel-dark grid gap-6 p-6 md:p-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="text-sm font-semibold text-sage-300">{t("rec.loading")}</div>
          <div className="h-10 w-2/3 animate-pulse rounded-xl bg-white/10" />
          <div className="h-16 w-1/2 animate-pulse rounded-xl bg-white/10" />
          <div className="h-6 w-1/3 animate-pulse rounded-xl bg-white/10" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded-full bg-white/10" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

function LotBar({ lot, updating }: { lot: ProduceLot; updating: boolean }) {
  const { t, lang, updateLot } = useApp();
  const c = COMMODITIES[lot.commodityId];
  const origin = resolveOrigin(lot);
  const scenario = lot.scenarioId ? SCENARIO_BY_ID[lot.scenarioId] : null;
  const hasGaps = !!(scenario?.feedOverrides || scenario?.chargeOverrides);
  const gs = lot.gradeStatus === "verified" ? "gs.verified" : lot.gradeStatus === "declared" ? "gs.declared" : "gs.unknown";

  return (
    <div className="space-y-3 animate-rise">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/farmer" className="inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> {t("rec.backToLots")}
        </Link>
        <div className="flex items-center gap-2">
          {updating && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <RefreshCcw className="size-3.5 animate-spin" /> {t("rec.updating")}
            </span>
          )}
          {scenario && <Badge tone="dark">Scenario {scenario.id}</Badge>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-display text-lg font-semibold">{c.name[lang]}</span>
        <Chip>{lot.variety}</Chip>
        <Chip>
          <b className="tabular">{lot.quantityQtl}</b> {t("common.qtl")}
        </Chip>
        <Chip>
          {getGrade(lot.commodityId, lot.gradeId).label[lang]} · {t(gs)}
        </Chip>
        <Chip>
          <MapPin className="size-3.5" /> {origin.label}
        </Chip>
        <Chip>{t("farmer.harvested", { date: lot.harvestDate })}</Chip>
        {lot.reservePricePerQtl ? <Chip>{t("rec.reserveNow", { reserve: lot.reservePricePerQtl })}</Chip> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-faint">{t("rec.riskPref")}</span>
          <Segmented<RiskPreference>
            size="sm"
            label={t("rec.riskPref")}
            value={lot.riskPreference}
            onChange={(v) => updateLot(lot.id, { riskPreference: v })}
            options={[
              { value: "cautious", label: t("risk.cautious") },
              { value: "balanced", label: t("risk.balanced") },
              { value: "patient", label: t("risk.patient") },
            ]}
          />
        </div>
        {hasGaps && (
          <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2" title={t("rec.gapsHint")}>
            <span className="text-xs font-bold uppercase tracking-wide text-faint">{t("rec.gaps")}</span>
            <Segmented<"on" | "off">
              size="sm"
              label={t("rec.gaps")}
              value={lot.ignoreScenarioGaps ? "off" : "on"}
              onChange={(v) => updateLot(lot.id, { ignoreScenarioGaps: v === "off" })}
              options={[
                { value: "on", label: t("rec.gapsOn") },
                { value: "off", label: t("rec.gapsOff") },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-1 text-[13px] text-ink-soft">{children}</span>;
}

function Result({ lot, rec }: { lot: ProduceLot; rec: Recommendation }) {
  const { t, addDecision } = useApp();
  const best = rec.options.find((o) => o.id === rec.bestOptionId) ?? null;
  const runner = rec.options.find((o) => o.id === rec.runnerUpOptionId) ?? null;
  const [message, setMessage] = useState<string | null>(null);
  const origin = resolveOrigin(lot);
  const isIllustrative = !!(lot.scenarioId && SCENARIO_BY_ID[lot.scenarioId]?.illustrative);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(id);
  }, [message]);

  const record = (action: SavedDecision["action"], option: RecommendationOption | null) => {
    addDecision({
      id: `d-${Date.now()}`,
      lotId: lot.id,
      optionId: option?.id ?? null,
      optionTitle: option?.title ?? "—",
      action,
      netPerQtl: option?.net?.netPerQtl.expected ?? null,
      netTotal: option?.net?.netTotal.expected ?? null,
      reservePricePerQtl: lot.reservePricePerQtl ?? null,
      savedAt: new Date().toISOString(),
    });
    setMessage(
      action === "accepted" ? t("rec.savedAccepted", { name: option?.title ?? "—" }) : action === "rejected" ? t("rec.savedRejected") : t("rec.savedSaved"),
    );
  };

  return (
    <>
      {isIllustrative && (
        <Notice tone="amber" icon={<Info className="size-4" />}>
          <b>{t("rec.illustrativeTag")}.</b> {t("assume.illustrative_prices")}
        </Notice>
      )}

      <Hero lot={lot} rec={rec} best={best} runner={runner} onAction={record} />

      <div role="status" aria-live="polite">
        {message && (
          <Notice tone="green" icon={<Check className="size-4" />} className="animate-rise">
            {message}
          </Notice>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <div className="space-y-6">
          {rec.status !== "insufficient" && best && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="p-5">
                <SectionTitle title={t("rec.why")} icon={<BadgeCheck className="size-5 text-emerald-600" />} />
                <ExplanationList kind="why" items={rec.why} icon={<Check className="size-3.5" />} />
              </Card>
              <Card className="p-5">
                <SectionTitle title={t("rec.change")} icon={<Scale className="size-5 text-amber-600" />} />
                <ExplanationList kind="change" items={rec.whatCouldChange} icon={<CircleAlert className="size-3.5" />} tone="amber" />
              </Card>
            </div>
          )}

          <Card className="p-5" id="compare">
            <SectionTitle title={t("rec.compare")} sub={t("rec.compareSub")} icon={<ListOrdered className="size-5 text-forest-700" />} />
            {rec.options.length > 0 && (
              <div className="mb-5 rounded-2xl bg-ivory/70 p-4">
                <CompareBars options={rec.options} bestId={rec.bestOptionId} />
              </div>
            )}
            <div className="space-y-3">
              {rec.options.map((o) => (
                <OptionCard key={o.id} option={o} best={best} lot={lot} onChoose={(opt) => record("accepted", opt)} defaultOpen={o.id === rec.bestOptionId && rec.options.length <= 2} />
              ))}
            </div>
            {rec.ineligible.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-faint">
                  {t("rec.ineligibleTitle")} · {t("rec.notAvailable")}
                </div>
                <div className="space-y-2">
                  {rec.ineligible.map((o) => (
                    <OptionCard key={o.id} option={o} best={best} lot={lot} />
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle title={t("rec.mapTitle")} icon={<MapPin className="size-5 text-emerald-600" />} />
            <MarketMap origin={origin} options={[...rec.options, ...rec.ineligible]} bestId={rec.bestOptionId} radiusKm={lot.radiusKm} />
          </Card>
          {rec.storageCurve && <StorageExplorer lot={lot} rec={rec} />}
          <DataPanel rec={rec} />
        </div>
      </div>
    </>
  );
}

function Hero({
  lot,
  rec,
  best,
  runner,
  onAction,
}: {
  lot: ProduceLot;
  rec: Recommendation;
  best: RecommendationOption | null;
  runner: RecommendationOption | null;
  onAction: (a: SavedDecision["action"], o: RecommendationOption | null) => void;
}) {
  const { t, lang } = useApp();
  const [reserveOpen, setReserveOpen] = useState(false);
  const insufficient = rec.status === "insufficient";
  const n = best?.net ?? null;
  const kinds = useMemo(() => Array.from(new Set(best?.provenance.map((p) => p.kind) ?? [])), [best]);
  const observed = best?.provenance[0]?.observedAt.slice(0, 10);

  const statusTone = rec.status === "confident" ? "bg-emerald-500 text-forest-950" : rec.status === "tentative" ? "bg-amber-300 text-forest-950" : "bg-rust-600 text-white";
  const StatusIcon = rec.status === "confident" ? BadgeCheck : rec.status === "tentative" ? CircleAlert : TriangleAlert;

  return (
    <section className={cx("panel-dark grain relative overflow-hidden shadow-[var(--shadow-lift)] animate-rise", insufficient && "ring-2 ring-rust-600/60")}>
      <div className="grid gap-8 p-5 md:p-8 lg:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold", statusTone)}>
              <StatusIcon className="size-3.5" /> {t(`rec.status.${rec.status}`)}
            </span>
            <SpeakButton rec={rec} best={best} />
          </div>
          <div className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">{insufficient ? t("rec.leading") : t("rec.header")}</div>

          {best && n ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone="dark">
                  {best.kind === "store" ? <Warehouse className="size-3.5" /> : best.kind === "fpo" ? <Truck className="size-3.5" /> : <MapPin className="size-3.5" />}
                  {t(`kind.${best.kind}`)}
                </Badge>
              </div>
              <h1 className={cx("mt-2 font-display font-semibold leading-[1.05] tracking-tight", best.title.length > 40 ? "text-2xl md:text-3xl" : "text-4xl md:text-5xl")}>
                {best.title}
              </h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-sage-300">
                {best.distanceKm !== null && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {t("rec.distance", { km: Math.round(best.distanceKm) })}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {t("rec.saleDay")} {best.sellAfterDays === 0 ? t("rec.today") : best.sellAfterDays === 1 ? t("rec.tomorrow") : t("rec.inDays", { n: best.sellAfterDays })}
                </span>
                {rec.remainingShelfLifeDays !== null && (
                  <span className={cx("inline-flex items-center gap-1 font-bold", rec.remainingShelfLifeDays <= 2 ? "text-rust-100" : "text-amber-300")}>
                    <TriangleAlert className="size-3.5" />
                    {t("rec.shelfLeft", { days: Math.max(0, rec.remainingShelfLifeDays) })}
                  </span>
                )}
              </div>

              <div className="mt-6">
                <div className="text-sm text-sage-300">{t("rec.netLot", { qty: lot.quantityQtl })}</div>
                <div className="tabular font-display text-5xl font-semibold leading-none text-white md:text-6xl">
                  {inr(n.netTotal.expected)}
                  {n.isUpperBound && <span className="text-rust-100">*</span>}
                </div>
                <div className="tabular mt-2 flex flex-wrap items-baseline gap-x-3 text-sage-200">
                  <span className="text-xl font-bold text-emerald-300">
                    {inr(n.netPerQtl.expected)} <span className="text-sm font-semibold text-sage-300">{t("rec.perQtl")}</span>
                  </span>
                  <span className="text-sm">
                    {t("rec.range")} {inr(n.netPerQtl.low)} – {inr(n.netPerQtl.high)}
                  </span>
                </div>
              </div>

              {rec.diffVsRunnerUp && runner && rec.diffVsRunnerUp.perQtl > 0 && (
                <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-2xl bg-emerald-500/15 px-4 py-2.5 text-sm text-emerald-100 ring-1 ring-emerald-500/30">
                  <span className="tabular font-display text-xl font-semibold text-emerald-300">+{inr(rec.diffVsRunnerUp.total)}</span>
                  <span>
                    {t("rec.moreThan", { amount: Math.round(rec.diffVsRunnerUp.perQtl), name: runner.title })} {t("common.perQtl")}
                  </span>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <QualityBadge level={best.quality} />
                {kinds.map((k) => (
                  <DataKindBadge key={k} kind={k} className="bg-white/10! text-sage-100! border-white/15!" />
                ))}
                {observed && <span className="text-xs text-sage-400">{t("rec.observed", { date: observed })}</span>}
              </div>
              {best.flags.length > 0 && (
                <div className="mt-3 text-sm font-semibold text-amber-300">{best.flags.map((f) => t(`reason.${f.code}` as StringKey, f.params)).join(" · ")}</div>
              )}
            </>
          ) : (
            <h1 className="mt-2 font-display text-3xl font-semibold">{t("missing.no_eligible")}</h1>
          )}

          {insufficient && (
            <div className="mt-6 rounded-2xl bg-rust-600/15 p-4 ring-1 ring-rust-600/40">
              <div className="font-bold text-white">{t("rec.status.insufficient")}</div>
              <p className="mt-1 text-sm text-sage-200">{t("rec.insufficientSub")}</p>
              <div className="mt-3">
                <ExplanationList kind="missing" items={rec.missing} icon={<TriangleAlert className="size-3.5" />} tone="dark" />
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-2">
            {!insufficient && best && (
              <Button onClick={() => onAction("accepted", best)} className="bg-emerald-500! text-forest-950! hover:bg-emerald-300!">
                <Check className="size-4" /> {t("rec.accept")}
              </Button>
            )}
            <Button variant="secondary" className="border-white/20! bg-white/10! text-white! hover:bg-white/20!" onClick={() => onAction("saved", best)}>
              <Bookmark className="size-4" /> {t("rec.save")}
            </Button>
            <Button variant="secondary" className="border-white/20! bg-white/10! text-white! hover:bg-white/20!" onClick={() => setReserveOpen((v) => !v)} aria-expanded={reserveOpen}>
              <Scale className="size-4" /> {t("rec.setReserve")}
            </Button>
            <a href="#compare" className="inline-flex min-h-11 items-center gap-2 rounded-2xl px-4 text-[15px] font-bold text-sage-200 hover:bg-white/10 hover:text-white">
              <ListOrdered className="size-4" /> {t("rec.compare")}
            </a>
            <Button variant="ghost" className="text-sage-300! hover:bg-white/10!" onClick={() => onAction("rejected", best)}>
              <ThumbsDown className="size-4" /> {t("rec.reject")}
            </Button>
          </div>
          {reserveOpen && <ReserveForm lot={lot} onDone={() => setReserveOpen(false)} />}
          <p className="mt-4 max-w-xl text-xs leading-relaxed text-sage-400">{t("rec.actionNote")}</p>
        </div>

        <div className="min-w-0 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-sm font-bold text-sage-100">{t("rec.waterfall")}</div>
            <span className="text-xs text-sage-400">₹/{t("common.qtl")}</span>
          </div>
          {n ? <Waterfall net={n} dark /> : <p className="text-sm text-sage-300">—</p>}
          {lang && n && (
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center">
              <MiniStat label={t("rec.quote")} value={inr(n.price.expected)} />
              <MiniStat label={t("rec.totalCosts")} value={`− ${inr(n.knownCostPerQtl)}`} />
              <MiniStat label={t("home.example.net")} value={inr(n.netPerQtl.expected)} accent />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[11px] text-sage-400">{label}</div>
      <div className={cx("tabular mt-0.5 text-base font-extrabold", accent ? "text-emerald-300" : "text-white")}>{value}</div>
    </div>
  );
}

function ReserveForm({ lot, onDone }: { lot: ProduceLot; onDone: () => void }) {
  const { t, updateLot } = useApp();
  const [value, setValue] = useState(lot.reservePricePerQtl ? String(lot.reservePricePerQtl) : "");
  const [err, setErr] = useState(false);
  return (
    <form
      className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10 animate-rise"
      onSubmit={(e) => {
        e.preventDefault();
        const num = Number(value);
        if (!value.trim() || !Number.isFinite(num) || num <= 0) {
          setErr(true);
          return;
        }
        updateLot(lot.id, { reservePricePerQtl: Math.round(num) });
        onDone();
      }}
    >
      <label className="min-w-[180px] flex-1">
        <span className="mb-1 block text-xs font-bold text-sage-200">{t("rec.reserveLabel")}</span>
        <input
          className="input tabular"
          inputMode="numeric"
          type="number"
          min={1}
          value={value}
          aria-invalid={err}
          onChange={(e) => {
            setValue(e.target.value);
            setErr(false);
          }}
        />
      </label>
      <Button type="submit" className="bg-emerald-500! text-forest-950!">
        {t("rec.reserveApply")}
      </Button>
      {lot.reservePricePerQtl ? (
        <Button
          type="button"
          variant="ghost"
          className="text-sage-200! hover:bg-white/10!"
          onClick={() => {
            updateLot(lot.id, { reservePricePerQtl: null });
            onDone();
          }}
        >
          {t("rec.reserveClear")}
        </Button>
      ) : null}
      {err && <p className="w-full text-xs font-bold text-rust-100">{t("err.reserve")}</p>}
    </form>
  );
}

function SpeakButton({ rec, best }: { rec: Recommendation; best: RecommendationOption | null }) {
  const { t, lang } = useApp();
  const { item } = useExplain();
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);
  if (!best?.net) return null;
  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const text = [
      rec.status === "insufficient" ? t("rec.status.insufficient") : t("rec.speechIntro", { title: best.title, net: Math.round(best.net!.netPerQtl.expected) }),
      ...rec.why.slice(0, 3).map((w) => item("why", w)),
    ]
      .join(" ")
      .replace(/₹/g, "");
    const u = new SpeechSynthesisUtterance(text);
    u.lang = SPEECH_LANG[lang];
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(SPEECH_LANG[lang].slice(0, 2)));
    if (voice) u.voice = voice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(u);
    setSpeaking(true);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!supported}
      title={supported ? undefined : t("rec.voiceUnsupported")}
      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-white/10 px-3 text-xs font-bold text-sage-100 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {speaking ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}
      {speaking ? t("rec.stopListen") : supported ? t("rec.listen") : t("rec.voiceUnsupported")}
    </button>
  );
}

function StorageExplorer({ lot, rec }: { lot: ProduceLot; rec: Recommendation }) {
  const { t, updateLot } = useApp();
  const points = rec.storageCurve!;
  const sel = points.find((p) => p.days === lot.storageDays) ?? null;
  const now = points[0];
  return (
    <Card className="p-5">
      <SectionTitle title={t("rec.storageTitle")} sub={t("rec.storageSub")} icon={<Warehouse className="size-5 text-sky-700" />} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-faint">{t("rec.storagePeriod")}</span>
        <Segmented<string>
          size="sm"
          label={t("rec.storagePeriod")}
          value={String(lot.storageDays)}
          onChange={(v) => updateLot(lot.id, { storageDays: Number(v) })}
          options={points.filter((p) => p.days > 0).map((p) => ({ value: String(p.days), label: `${p.days} ${t("common.days")}` }))}
        />
      </div>
      <StorageChart points={points} selectedDays={lot.storageDays} />
      {sel && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-ivory p-3">
            <div className="text-xs text-muted">{t("rec.sellNow")}</div>
            <div className="tabular font-display text-xl font-semibold">{inr(now.net.expected)}</div>
          </div>
          <div className="rounded-xl bg-ivory p-3">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                {sel.days} {t("common.days")}
              </span>
              <QualityBadge level={sel.quality} compact className="py-0.5!" />
            </div>
            <div className="tabular font-display text-xl font-semibold">{inr(sel.net.expected)}</div>
            <div className="tabular text-xs text-muted">
              {inr(sel.net.low)} – {inr(sel.net.high)}
            </div>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">{t("assume.seasonal_reference")}</p>
    </Card>
  );
}

function DataPanel({ rec }: { rec: Recommendation }) {
  const { t } = useApp();
  const sources = new Map<string, Provenance>();
  for (const o of [...rec.options, ...rec.ineligible]) for (const p of o.provenance) if (!sources.has(p.sourceId + p.status)) sources.set(p.sourceId + p.status, p);
  return (
    <Card className="p-5">
      <SectionTitle title={t("rec.missing")} icon={<Database className="size-5 text-rust-600" />} />
      <ExplanationList kind="missing" items={rec.missing} icon={<TriangleAlert className="size-3.5" />} tone="rust" empty={t("rec.nothingMissing")} />
      <div className="mt-6 border-t border-line pt-5">
        <div className="mb-3 font-display text-base font-semibold">{t("rec.assumptions")}</div>
        <ExplanationList kind="assume" items={rec.assumptions} icon={<Info className="size-3.5" />} tone="amber" />
      </div>
      <div className="mt-6 border-t border-line pt-5">
        <div className="mb-3 font-display text-base font-semibold">{t("rec.sources")}</div>
        <ul className="space-y-2 text-sm">
          {[...sources.values()].map((p) => (
            <li key={p.sourceId + p.status} className="flex flex-wrap items-center gap-2">
              <DataKindBadge kind={p.kind} />
              <span className="font-semibold">{p.sourceName}</span>
              {p.status !== "ok" && <Badge tone={p.status === "stale" ? "amber" : "rust"}>{t(`feed.${p.status}`)}</Badge>}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          {t("rec.eligibleCount", { n: rec.stats.optionsCompared })} · {new Date(rec.generatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
    </Card>
  );
}
