"use client";

import { useState } from "react";
import { ChevronDown, Clock, MapPin, Pencil, RotateCcw, Truck } from "lucide-react";
import type { CostKey, ProduceLot, RecommendationOption } from "@/lib/domain/types";
import { inr, inrCompact } from "@/lib/i18n";
import { useApp } from "@/lib/store/AppProvider";
import { Badge, Button, DataKindBadge, QualityBadge, cx } from "@/components/ui/primitives";
import { useExplain } from "@/components/farmer/Explanations";

export function OptionCard({
  option,
  best,
  lot,
  onChoose,
  defaultOpen = false,
}: {
  option: RecommendationOption;
  best: RecommendationOption | null;
  lot: ProduceLot;
  onChoose?: (o: RecommendationOption) => void;
  defaultOpen?: boolean;
}) {
  const { t, updateLot } = useApp();
  const { reason } = useExplain();
  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const n = option.net;
  const isBest = best?.id === option.id;
  const diff = n && best?.net && !isBest ? n.netPerQtl.expected - best.net.netPerQtl.expected : null;
  const overrides = lot.costOverrides?.[option.id] ?? {};
  const hasEdits = Object.keys(overrides).length > 0;

  const setOverride = (key: CostKey, value: number | null | undefined) => {
    const next = { ...(lot.costOverrides ?? {}) };
    const cur = { ...(next[option.id] ?? {}) };
    if (value === undefined) delete cur[key];
    else cur[key] = value;
    if (Object.keys(cur).length) next[option.id] = cur;
    else delete next[option.id];
    updateLot(lot.id, { costOverrides: next });
  };

  const saleWhen = option.sellAfterDays === 0 ? t("rec.today") : option.sellAfterDays === 1 ? t("rec.tomorrow") : t("rec.inDays", { n: option.sellAfterDays });

  return (
    <div
      className={cx(
        "rounded-2xl border bg-paper transition-shadow",
        isBest ? "border-emerald-500 shadow-[0_0_0_3px_rgb(22_160_102/0.12)]" : option.eligible ? "border-line" : "border-dashed border-line-strong bg-paper/60",
      )}
    >
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full cursor-pointer items-start gap-3 p-4 text-left">
        <span
          className={cx(
            "grid size-9 shrink-0 place-items-center rounded-xl font-display text-base font-semibold",
            isBest ? "bg-emerald-600 text-white" : option.eligible ? "bg-sand text-ink-soft" : "bg-sand/60 text-faint",
          )}
        >
          {option.rank ?? "–"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={isBest ? "green" : "neutral"}>{t(`kind.${option.kind}`)}</Badge>
            {option.eligible && <QualityBadge level={option.quality} compact />}
            {option.flags.map((f) => (
              <Badge key={f.code} tone="rust">
                {reason(f)}
              </Badge>
            ))}
          </span>
          <span className="mt-1.5 block font-display text-[17px] font-semibold leading-snug text-ink">{option.title}</span>
          <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            {option.distanceKm !== null && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {t("rec.distance", { km: Math.round(option.distanceKm) })}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {t("rec.saleDay")} {saleWhen}
            </span>
            {option.vehicleSummary && (
              <span className="inline-flex items-center gap-1">
                <Truck className="size-3.5" />
                {option.vehicleSummary}
              </span>
            )}
          </span>
          {!option.eligible && (
            <span className="mt-2 block text-[13px] font-semibold text-rust-700">{option.ineligibleReasons.map((r) => reason(r)).join(" · ")}</span>
          )}
        </span>
        <span className="shrink-0 text-right">
          {n ? (
            <>
              <span className={cx("tabular block font-display text-xl font-semibold", isBest ? "text-emerald-700" : "text-ink")}>
                {inr(n.netPerQtl.expected)}
                {n.isUpperBound && <span className="text-rust-600">*</span>}
              </span>
              <span className="tabular block text-[11px] text-muted">
                {t("common.perQtl")} · {inrCompact(n.netTotal.expected)}
              </span>
              {diff !== null && option.eligible && (
                <span className={cx("tabular mt-0.5 block text-xs font-bold", diff < 0 ? "text-rust-600" : "text-emerald-700")}>
                  {diff < 0 ? "−" : "+"}
                  {inr(Math.abs(diff)).replace("−", "")}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm font-semibold text-faint">—</span>
          )}
          <ChevronDown className={cx("ml-auto mt-1 size-4 text-faint transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && n && (
        <div className="border-t border-line px-4 pb-4 pt-3 animate-fade">
          <div className="mb-3 grid gap-2 text-[13px] sm:grid-cols-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-faint">{t("rec.basis")}</div>
              <div className="text-ink-soft">{option.priceBasis}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-faint">{t("rec.range")}</div>
              <div className="tabular text-ink-soft">
                {t("rec.quote")}: {inr(n.price.low)} – {inr(n.price.high)} · {t("home.example.net")}: {inr(n.netPerQtl.low)} – {inr(n.netPerQtl.high)}
              </div>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wide text-faint">{t("rec.costWorking")}</div>
            <div className="flex gap-1">
              {hasEdits && (
                <Button size="sm" variant="ghost" onClick={() => updateLot(lot.id, { costOverrides: Object.fromEntries(Object.entries(lot.costOverrides ?? {}).filter(([k]) => k !== option.id)) })}>
                  <RotateCcw className="size-3.5" /> {t("rec.resetEdits")}
                </Button>
              )}
              <Button size="sm" variant={editing ? "dark" : "secondary"} onClick={() => setEditing((e) => !e)}>
                <Pencil className="size-3.5" /> {editing ? t("rec.doneEditing") : t("rec.editCosts")}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-line">
            <table className="w-full text-[13px]">
              <tbody>
                <tr className="bg-sage-100/60">
                  <td className="px-3 py-2 font-bold">{t("rec.quote")}</td>
                  <td className="hidden px-3 py-2 text-muted sm:table-cell" />
                  <td className="tabular px-3 py-2 text-right font-bold">{inr(n.price.expected)}</td>
                </tr>
                {n.costs.map((c) => (
                  <tr key={c.key} className="border-t border-line align-top">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-ink-soft">{t(`cost.${c.key}`)}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        <Badge tone={c.basis === "unknown" ? "rust" : c.basis === "override" ? "sky" : c.basis === "illustrative" ? "amber" : "outline"} className="px-1.5! py-0! text-[10px]!">
                          {t(`basis.${c.basis}`)}
                        </Badge>
                      </div>
                      <div className="mt-1 text-[11.5px] leading-snug text-faint sm:hidden">{c.detail}</div>
                    </td>
                    <td className="hidden px-3 py-2 text-[12px] leading-snug text-muted sm:table-cell">{c.detail}</td>
                    <td className="px-3 py-2 text-right">
                      {editing && c.editable ? (
                        <div className="flex flex-col items-end gap-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            aria-label={`${t(`cost.${c.key}`)} ₹/qtl`}
                            className="input tabular min-h-9! w-24 px-2! py-1! text-right text-sm"
                            key={`${c.key}-${c.perQtl}`}
                            defaultValue={c.perQtl ?? ""}
                            onBlur={(e) => {
                              const v = e.currentTarget.value.trim();
                              if (v === "") return;
                              const num = Number(v);
                              if (Number.isFinite(num) && num >= 0 && num !== c.perQtl) setOverride(c.key, num);
                            }}
                          />
                          <button type="button" className="cursor-pointer text-[11px] font-bold text-rust-600 hover:underline" onClick={() => setOverride(c.key, null)}>
                            {t("rec.markUnknown")}
                          </button>
                        </div>
                      ) : (
                        <span className={cx("tabular font-semibold", c.perQtl === null ? "text-rust-600" : "text-ink-soft")}>
                          {c.perQtl === null ? t("rec.unknown") : `− ${inr(c.perQtl)}`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-line-strong bg-emerald-50">
                  <td className="px-3 py-2 font-extrabold text-emerald-700">{t("home.example.net")}</td>
                  <td className="hidden sm:table-cell" />
                  <td className="tabular px-3 py-2 text-right font-extrabold text-emerald-700">
                    {inr(n.netPerQtl.expected)}
                    {n.isUpperBound && "*"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          {n.isUpperBound && <p className="mt-2 text-xs font-semibold text-rust-700">* {t("rec.upperBound")}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {option.provenance.map((p, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs text-muted">
                <DataKindBadge kind={p.kind} />
                {p.sourceName} · {t("rec.observed", { date: p.observedAt.slice(0, 10) })}
              </span>
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {option.qualityReasons.map((r, i) => (
              <li key={i}>
                <Badge tone={r.impact === "down" ? "amber" : "outline"}>{reason(r)}</Badge>
              </li>
            ))}
          </ul>
          {onChoose && option.eligible && !isBest && (
            <div className="mt-4">
              <Button size="sm" variant="secondary" onClick={() => onChoose(option)}>
                {t("rec.chooseThis")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
