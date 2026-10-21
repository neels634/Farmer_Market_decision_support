"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BuyerDemand, DemoSettings, Lang, ProduceLot, Recommendation, SavedDecision } from "@/lib/domain/types";
import { defaultSettings } from "@/lib/data/markets";
import { SCENARIOS, buildScenarioLot, scenarioLotId, type ScenarioId } from "@/lib/data/scenarios";
import { makeT, type Translator } from "@/lib/i18n";

// Client-side demo store, persisted to localStorage. Nothing here is sent to a
// server except the lot + settings needed to compute a recommendation.

const STORAGE_KEY = "netbhav:v1";
/** Placeholder clock used only before hydration; real time is read in an effect. */
export const PRE_HYDRATION_DATE = new Date("2026-01-01T00:00:00Z");

type ScenarioEdits = Partial<Pick<ProduceLot, "costOverrides" | "riskPreference" | "reservePricePerQtl" | "storageDays" | "ignoreScenarioGaps" | "cashNeededWithinDays">>;

export interface LotMetric {
  diffPerQtl: number | null;
  optionsCompared: number;
  optionsWithCompleteCosts: number;
  optionsWithProvenance: number;
  staleOrMissingFeeds: number;
  feedsConsidered: number;
  status: Recommendation["status"];
  at: string;
}

interface PersistedState {
  lang: Lang;
  lots: ProduceLot[];
  scenarioEdits: Partial<Record<ScenarioId, ScenarioEdits>>;
  decisions: SavedDecision[];
  buyerPosts: BuyerDemand[];
  settings: DemoSettings;
  metrics: { recommendations: number; byLot: Record<string, LotMetric> };
}

function initialState(): PersistedState {
  return {
    lang: "en",
    lots: [],
    scenarioEdits: {},
    decisions: [],
    buyerPosts: [],
    settings: defaultSettings(),
    metrics: { recommendations: 0, byLot: {} },
  };
}

function load(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const base = initialState();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}), feeds: { ...base.settings.feeds, ...(parsed.settings?.feeds ?? {}) } },
      metrics: { ...base.metrics, ...(parsed.metrics ?? {}) },
    };
  } catch {
    return initialState();
  }
}

interface AppContextValue {
  hydrated: boolean;
  lang: Lang;
  t: Translator;
  setLang(lang: Lang): void;
  scenarioLots: ProduceLot[];
  userLots: ProduceLot[];
  allLots: ProduceLot[];
  getLot(id: string): ProduceLot | undefined;
  addLot(lot: ProduceLot): void;
  updateLot(id: string, patch: Partial<ProduceLot>): void;
  removeLot(id: string): void;
  decisions: SavedDecision[];
  addDecision(d: SavedDecision): void;
  buyerPosts: BuyerDemand[];
  addBuyerPost(d: BuyerDemand): void;
  removeBuyerPost(id: string): void;
  settings: DemoSettings;
  setSettings(s: DemoSettings): void;
  metrics: PersistedState["metrics"];
  recordRecommendation(lotId: string, rec: Recommendation): void;
  resetAll(): void;
  now: Date;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState<Date>(PRE_HYDRATION_DATE);
  const skipSave = useRef(true);

  useEffect(() => {
    // Hydrate from localStorage after mount (avoids SSR mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(load());
    setNow(new Date());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage may be unavailable (private mode); the session still works */
    }
  }, [state, hydrated]);

  useEffect(() => {
    document.documentElement.lang = state.lang === "en" ? "en" : state.lang;
  }, [state.lang]);

  const scenarioLots = useMemo(
    () => SCENARIOS.map((s) => ({ ...buildScenarioLot(s.id, now), ...(state.scenarioEdits[s.id] ?? {}) })),
    [state.scenarioEdits, now],
  );

  const t = useMemo(() => makeT(state.lang), [state.lang]);

  const updateLot = useCallback((id: string, patch: Partial<ProduceLot>) => {
    setState((s) => {
      const scenario = SCENARIOS.find((x) => scenarioLotId(x.id) === id);
      if (scenario) {
        return { ...s, scenarioEdits: { ...s.scenarioEdits, [scenario.id]: { ...(s.scenarioEdits[scenario.id] ?? {}), ...patch } } };
      }
      return { ...s, lots: s.lots.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
    });
  }, []);

  const recordRecommendation = useCallback((lotId: string, rec: Recommendation) => {
    setState((s) => {
      const prev = s.metrics.byLot[lotId];
      const metric: LotMetric = {
        diffPerQtl: rec.diffVsRunnerUp?.perQtl ?? null,
        ...rec.stats,
        status: rec.status,
        at: rec.generatedAt,
      };
      const same =
        prev &&
        prev.diffPerQtl === metric.diffPerQtl &&
        prev.status === metric.status &&
        prev.optionsCompared === metric.optionsCompared &&
        prev.staleOrMissingFeeds === metric.staleOrMissingFeeds;
      if (same) return s;
      return { ...s, metrics: { recommendations: s.metrics.recommendations + 1, byLot: { ...s.metrics.byLot, [lotId]: metric } } };
    });
  }, []);

  const value: AppContextValue = {
    hydrated,
    lang: state.lang,
    t,
    setLang: (lang) => setState((s) => ({ ...s, lang })),
    scenarioLots,
    userLots: state.lots,
    allLots: [...state.lots, ...scenarioLots],
    getLot: (id) => state.lots.find((l) => l.id === id) ?? scenarioLots.find((l) => l.id === id),
    addLot: (lot) => setState((s) => ({ ...s, lots: [lot, ...s.lots] })),
    updateLot,
    removeLot: (id) =>
      setState((s) => ({ ...s, lots: s.lots.filter((l) => l.id !== id), decisions: s.decisions.filter((d) => d.lotId !== id) })),
    decisions: state.decisions,
    addDecision: (d) => setState((s) => ({ ...s, decisions: [d, ...s.decisions].slice(0, 50) })),
    buyerPosts: state.buyerPosts,
    addBuyerPost: (d) => setState((s) => ({ ...s, buyerPosts: [d, ...s.buyerPosts] })),
    removeBuyerPost: (id) => setState((s) => ({ ...s, buyerPosts: s.buyerPosts.filter((b) => b.id !== id) })),
    settings: state.settings,
    setSettings: (settings) => setState((s) => ({ ...s, settings })),
    metrics: state.metrics,
    recordRecommendation,
    resetAll: () => setState((s) => ({ ...initialState(), lang: s.lang })),
    now,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
