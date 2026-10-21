import { describe, expect, it } from "vitest";
import { defaultSettings, MARKET_BY_ID, DEFAULT_VEHICLES } from "@/lib/data/markets";
import { getFeedsForCommodity } from "@/lib/data/sources";
import { seedFpos } from "@/lib/data/actors";
import { detectAnomalies } from "@/lib/engine/insights";
import { compareAggregation } from "@/lib/engine/fpo";

const NOW = new Date("2026-10-21T06:00:00Z");

describe("demo feed", () => {
  it("is deterministic and ends exactly on the configured reference price", () => {
    const a = getFeedsForCommodity("soybean", defaultSettings(), NOW);
    const b = getFeedsForCommodity("soybean", defaultSettings(), NOW);
    expect(a).toEqual(b);
    expect(a.find((f) => f.marketId === "hinganghat")!.latest!.modalPrice).toBe(4520);
  });

  it("never invents a price for an unavailable feed and marks stale feeds", () => {
    const s = defaultSettings();
    s.feeds.nagpur = { status: "unavailable", ageDays: 0 };
    s.feeds.wardha = { status: "ok", ageDays: 10 };
    const feeds = getFeedsForCommodity("soybean", s, NOW);
    const nagpur = feeds.find((f) => f.marketId === "nagpur")!;
    expect(nagpur.latest).toBeNull();
    expect(nagpur.history).toHaveLength(0);
    expect(feeds.find((f) => f.marketId === "wardha")!.provenance.status).toBe("stale");
  });
});

describe("anomaly flags (experimental)", () => {
  it("finds the seeded low-competition drop and arrivals spike", () => {
    const feeds = [...getFeedsForCommodity("soybean", defaultSettings(), NOW), ...getFeedsForCommodity("orange", defaultSettings(), NOW)];
    const found = detectAnomalies(feeds).map((a) => `${a.marketId}:${a.commodityId}:${a.kind}`);
    expect(found).toContain("umred:soybean:low_competition");
    expect(found).toContain("umred:soybean:price_drop");
    expect(found).toContain("nagpur:orange:arrival_spike");
  });
});

describe("FPO aggregation", () => {
  it("lowers per-quintal logistics cost for small members", () => {
    const fpo = seedFpos(NOW)[0];
    const r = compareAggregation({
      fpo,
      members: fpo.members.tur!.map((m) => ({ id: m.id, label: m.farmerLabel, quantityQtl: m.quantityQtl })),
      destination: MARKET_BY_ID.nagpur,
      vehicles: DEFAULT_VEHICLES,
      roadFactor: 1.3,
      serviceFeePerQtl: 25,
      collectionPerQtl: 12,
      memberOffsetKm: 5,
    });
    expect(r.pooledQty).toBe(66);
    expect(r.avgPooledPerQtl).toBeLessThan(r.avgAlonePerQtl);
    expect(r.members.every((m) => m.savingPerQtl > 0)).toBe(true);
  });

  it("handles an empty pool without dividing by zero", () => {
    const fpo = seedFpos(NOW)[0];
    const r = compareAggregation({ fpo, members: [], destination: MARKET_BY_ID.nagpur, vehicles: DEFAULT_VEHICLES, roadFactor: 1.3, serviceFeePerQtl: 25, collectionPerQtl: 12, memberOffsetKm: 5 });
    expect(r.pooledQty).toBe(0);
    expect(r.members).toHaveLength(0);
  });
});
