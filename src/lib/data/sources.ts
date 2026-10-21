import type { CommodityId, DataKind, DemoSettings, MarketFeed, PriceObservation, Provenance } from "@/lib/domain/types";
import { DEMO_MODAL_PRICES, MARKETS } from "@/lib/data/markets";
import { addDays, dateOnly } from "@/lib/domain/dates";

// ---------------------------------------------------------------------------
// Data-source registry. Adapters are kept separate from recommendation logic
// so a verified source can be plugged in later without touching the engine.
// ---------------------------------------------------------------------------

export interface DataSourceInfo {
  id: string;
  name: string;
  kind: DataKind;
  connected: boolean;
  description: string;
}

export const DATA_SOURCES: DataSourceInfo[] = [
  {
    id: "demo-feed",
    name: "NetBhav demo market feed",
    kind: "demo",
    connected: true,
    description:
      "Deterministic simulated prices, arrivals and bidder counts for 10 Nagpur-region APMCs. Generated locally; not real market data.",
  },
  {
    id: "illustrative",
    name: "PRD worked example",
    kind: "illustrative",
    connected: true,
    description: "Fixed illustrative figures from the product brief (Nagpur vs Wardha soybean). Used only in Scenario A.",
  },
  {
    id: "buyer-posts",
    name: "Simulated buyer postings",
    kind: "demo",
    connected: true,
    description: "Demo buyer demand posts, plus any posts created in this browser. No real buyers are represented.",
  },
  {
    id: "fpo-demo",
    name: "Simulated FPO records",
    kind: "demo",
    connected: true,
    description: "Demo FPO groups and member lots used to illustrate aggregation economics.",
  },
  {
    id: "agmarknet",
    name: "AGMARKNET",
    kind: "live",
    connected: false,
    description: "Not connected. API access, terms and licensing have not been verified for this prototype, so no data is fetched.",
  },
  {
    id: "enam",
    name: "e-NAM",
    kind: "live",
    connected: false,
    description: "Not connected. Integration would require verified API access; this prototype does not call e-NAM.",
  },
  {
    id: "weather",
    name: "Weather service",
    kind: "live",
    connected: false,
    description: "Not connected. Weather is not used in the current recommendation logic.",
  },
];

export interface MarketDataAdapter {
  id: string;
  getFeed(marketId: string, commodityId: CommodityId, settings: DemoSettings, now: Date): MarketFeed | null;
}

// ---- deterministic pseudo-random helpers ----------------------------------

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HISTORY_DAYS = 60;

/** Special patterns seeded into the demo feed so insights have something to find. */
const SEEDED_PATTERNS: Record<string, { lastDayFrom?: number; lastBidders?: number; arrivalsSpike?: number }> = {
  // Sharp one-day drop with very few bidders: an "unusual price / low competition" demo case.
  "umred:soybean": { lastDayFrom: 4460, lastBidders: 3 },
  // Arrivals spike: a "possible supply pressure" demo case.
  "nagpur:orange": { arrivalsSpike: 1.9 },
};

const BASE_ARRIVALS: Partial<Record<CommodityId, number>> = { orange: 900, soybean: 1400, tur: 600 };

function buildHistory(marketId: string, commodityId: CommodityId, target: number, endDate: string): PriceObservation[] {
  const key = `${marketId}:${commodityId}`;
  const rnd = mulberry32(hashString(key));
  const pattern = SEEDED_PATTERNS[key] ?? {};
  const walkTarget = pattern.lastDayFrom ?? target;
  const vol = commodityId === "orange" ? 0.012 : 0.007;

  const walk: number[] = [walkTarget * (0.97 + rnd() * 0.04)];
  for (let i = 1; i < HISTORY_DAYS; i++) {
    walk.push(walk[i - 1] * (1 + (rnd() - 0.5) * 2 * vol));
  }
  // Bend the random walk so it ends exactly on the configured reference price.
  const end = walk[HISTORY_DAYS - 1];
  const corrected = walk.map((v, i) => v + (walkTarget - end) * (i / (HISTORY_DAYS - 1)));
  if (pattern.lastDayFrom) corrected[HISTORY_DAYS - 1] = target;

  const sizeFactor = marketId === "nagpur" ? 1.8 : marketId === "amravati" ? 1.5 : 0.7 + (hashString(marketId) % 50) / 100;
  const baseArrivals = (BASE_ARRIVALS[commodityId] ?? 500) * sizeFactor;

  return corrected.map((modal, i) => {
    const date = addDays(endDate, i - (HISTORY_DAYS - 1));
    const m = Math.round(modal / 5) * 5;
    const spread = commodityId === "orange" ? 0.14 : 0.06;
    let arrivals = baseArrivals * (0.75 + rnd() * 0.5);
    if (i === HISTORY_DAYS - 1 && pattern.arrivalsSpike) arrivals = baseArrivals * pattern.arrivalsSpike;
    let bidders = Math.round(8 + rnd() * 10);
    if (i === HISTORY_DAYS - 1 && pattern.lastBidders) bidders = pattern.lastBidders;
    return {
      marketId,
      commodityId,
      date,
      modalPrice: m,
      minPrice: Math.round((m * (1 - spread * (0.6 + rnd() * 0.4))) / 5) * 5,
      maxPrice: Math.round((m * (1 + spread * (0.4 + rnd() * 0.3))) / 5) * 5,
      arrivalsQtl: Math.round(arrivals),
      bidders,
    };
  });
}

export const demoFeedAdapter: MarketDataAdapter = {
  id: "demo-feed",
  getFeed(marketId, commodityId, settings, now) {
    const target = DEMO_MODAL_PRICES[marketId]?.[commodityId];
    if (target == null) return null;
    const feed = settings.feeds[marketId] ?? { status: "ok", ageDays: 1 };
    const today = dateOnly(now);

    if (feed.status === "unavailable") {
      const provenance: Provenance = {
        sourceId: "demo-feed",
        sourceName: "NetBhav demo market feed",
        kind: "demo",
        observedAt: now.toISOString(),
        status: "unavailable",
        note: "Feed marked unavailable in Demo controls; no price is shown rather than a guessed one.",
      };
      return { marketId, commodityId, latest: null, history: [], provenance, ageDays: null };
    }

    const ageDays = Math.max(0, Math.round(feed.ageDays));
    const endDate = addDays(today, -ageDays);
    const history = buildHistory(marketId, commodityId, target, endDate);
    const latest = history[history.length - 1];
    const stale = feed.status === "stale" || ageDays > 7;
    const provenance: Provenance = {
      sourceId: "demo-feed",
      sourceName: "NetBhav demo market feed",
      kind: "demo",
      observedAt: `${latest.date}T11:30:00+05:30`,
      status: stale ? "stale" : "ok",
      note: stale ? `Last observation is ${ageDays} days old.` : undefined,
    };
    return { marketId, commodityId, latest, history, provenance, ageDays };
  },
};

export function getFeedsForCommodity(commodityId: CommodityId, settings: DemoSettings, now: Date): MarketFeed[] {
  return MARKETS.filter((m) => m.commodities.includes(commodityId))
    .map((m) => demoFeedAdapter.getFeed(m.id, commodityId, settings, now))
    .filter((f): f is MarketFeed => f !== null);
}
