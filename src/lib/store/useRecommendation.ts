"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProduceLot, Recommendation } from "@/lib/domain/types";
import { useApp } from "@/lib/store/AppProvider";

type State =
  | { phase: "idle" | "loading"; data: Recommendation | null; error: null }
  | { phase: "ready"; data: Recommendation; error: null }
  | { phase: "error"; data: Recommendation | null; error: string };

/** Fetches a recommendation from the local route handler; re-runs (debounced) when inputs change. */
export function useRecommendation(lot: ProduceLot | undefined) {
  const { settings, buyerPosts, recordRecommendation } = useApp();
  const [state, setState] = useState<State>({ phase: "idle", data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const key = lot ? JSON.stringify({ lot, settings, buyerPosts }) : null;

  useEffect(() => {
    if (!key || !lot) return;
    const ctrl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctrl;
    const timer = setTimeout(async () => {
      setState((s) => ({ phase: "loading", data: s.data, error: null }));
      try {
        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lot, settings, userBuyerDemands: buyerPosts }),
          signal: ctrl.signal,
        });
        const json = await res.json();
        if (!res.ok) {
          const detail = json.issues?.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join("; ");
          throw new Error(detail || json.error || `Request failed (${res.status})`);
        }
        const rec = json.recommendation as Recommendation;
        setState({ phase: "ready", data: rec, error: null });
        recordRecommendation(lot.id, rec);
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ phase: "error", data: s.data, error: e instanceof Error ? e.message : "Network error" }));
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
    // `key` captures lot/settings/buyerPosts by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}
