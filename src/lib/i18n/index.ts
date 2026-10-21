import type { Lang } from "@/lib/domain/types";
import { en, hi, mr, type StringKey } from "@/lib/i18n/strings";

export type { StringKey };
export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: "mr", label: "मराठी", short: "मरा" },
  { id: "hi", label: "हिन्दी", short: "हि" },
  { id: "en", label: "English", short: "EN" },
];

const DICTS: Record<Lang, Partial<Record<StringKey, string>>> = { en, hi, mr };

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100 || Number.isInteger(n)) return Math.round(n).toLocaleString("en-IN");
  return (Math.round(n * 10) / 10).toLocaleString("en-IN");
}

export function inr(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const r = Math.round(n);
  return `${r < 0 ? "−" : ""}₹${Math.abs(r).toLocaleString("en-IN")}`;
}

/** Compact ₹ for big totals: ₹1.8 L, ₹12,400. */
export function inrCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e7) return `${n < 0 ? "−" : ""}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${n < 0 ? "−" : ""}₹${(a / 1e5).toFixed(2)} L`;
  return inr(n);
}

export type Translator = (key: StringKey, params?: Record<string, string | number>) => string;

/** Params with these names are themselves translation keys (e.g. a cost key). */
const PARAM_NAMESPACES: Record<string, string> = {
  cost: "cost.",
  group: "group.",
  preference: "risk.",
  level: "quality.",
  status: "feed.",
};

export function makeT(lang: Lang): Translator {
  const dict = DICTS[lang];
  const t: Translator = (key, params) => {
    let s = dict[key] ?? en[key] ?? key;
    if (params) {
      s = s.replace(/\{(\w+)\}/g, (_, name: string) => {
        const v = params[name];
        if (v === undefined) return `{${name}}`;
        const ns = PARAM_NAMESPACES[name];
        if (ns && typeof v === "string") {
          const k = `${ns}${v}` as StringKey;
          const tr = dict[k] ?? en[k];
          if (tr) return name === "group" ? tr.toLowerCase() : tr;
        }
        if (name.startsWith("delta") && typeof v === "number") {
          const r = Math.round(v);
          return `${r >= 0 ? "+" : "−"}₹${Math.abs(r).toLocaleString("en-IN")}`;
        }
        if (name === "floor" && typeof v === "number") return inr(v);
        return typeof v === "number" ? formatNumber(v) : v;
      });
    }
    return s;
  };
  return t;
}
