import { describe, expect, it } from "vitest";
import { buildScenarioLot } from "@/lib/data/scenarios";
import { defaultSettings } from "@/lib/data/markets";
import { seedBuyerDemands, seedFpos } from "@/lib/data/actors";
import { recommend } from "@/lib/engine/recommend";
import type { ProduceLot } from "@/lib/domain/types";

const NOW = new Date("2026-10-21T06:00:00Z");
const run = (lot: ProduceLot, settings = defaultSettings()) =>
  recommend({ lot, settings, now: NOW, buyerDemands: seedBuyerDemands(NOW), fpos: seedFpos(NOW) });


describe("Scenario A — lower quote, better net (illustrative)", () => {
  const r = run(buildScenarioLot("A", NOW));
  it("recommends Wardha despite Nagpur's higher quote", () => {
    expect(r.bestOptionId).toBe("market:wardha");
    expect(r.runnerUpOptionId).toBe("market:nagpur");
    const w = r.options[0].net!;
    const n = r.options[1].net!;
    expect(n.price.expected).toBe(4720);
    expect(w.price.expected).toBe(4610);
    expect(n.netPerQtl.expected).toBe(4330);
    expect(w.netPerQtl.expected).toBe(4450);
    expect(r.diffVsRunnerUp).toEqual({ perQtl: 120, total: 4800 });
    expect(r.why.map((w) => w.code)).toContain("lower_quote_higher_net");
    expect(r.options.every((o) => o.provenance[0].kind === "illustrative")).toBe(true);
  });
});

describe("Scenario B — perishable oranges", () => {
  const r = run(buildScenarioLot("B", NOW));
  it("does not pick the highest-quote distant market", () => {
    const best = r.options[0];
    expect(best.marketId).not.toBe("amravati");
    const amravati = r.options.find((o) => o.marketId === "amravati")!;
    expect(amravati.net!.price.expected).toBeGreaterThan(best.net!.price.expected);
    expect(amravati.net!.costs.find((c) => c.key === "spoilage")!.perQtl).toBeGreaterThan(0);
    expect(r.remainingShelfLifeDays).toBe(7);
  });
  it("marks storage as unsuitable for a perishable crop", () => {
    expect(r.ineligible.find((o) => o.id === "store")?.ineligibleReasons[0].code).toBe("storage_unsuitable");
  });
  it("excludes markets once shelf life would be exceeded", () => {
    const lot = { ...buildScenarioLot("B", NOW), harvestDate: "2026-10-14" };
    const late = run(lot);
    const amravati = late.ineligible.find((o) => o.marketId === "amravati");
    expect(amravati?.ineligibleReasons.map((x) => x.code)).toContain("shelf_life_exceeded");
  });
});

describe("Scenario C — storage decision", () => {
  it("shows storage range and respects risk preference", () => {
    const lot = { ...buildScenarioLot("C", NOW), storageDays: 90 };
    const balanced = run(lot);
    const store = balanced.options.find((o) => o.kind === "store")!;
    expect(store).toBeDefined();
    expect(store.net!.netPerQtl.high - store.net!.netPerQtl.low).toBeGreaterThan(500);
    expect(store.quality).not.toBe("High");
    expect(balanced.storageCurve?.map((p) => p.days)).toEqual([0, 30, 60, 90, 120]);
    const cautious = run({ ...lot, riskPreference: "cautious" });
    expect(cautious.options[0].kind).not.toBe("store");
    const patient = run({ ...lot, riskPreference: "patient" });
    expect(patient.options[0].kind).toBe("store");
    expect(patient.status).toBe("tentative");
    // At the default 60-day horizon a balanced farmer is advised to sell now.
    const sixty = run(buildScenarioLot("C", NOW));
    expect(sixty.options[0].kind).not.toBe("store");
    expect(sixty.whatCouldChange.map((x) => x.code)).toContain("storage_option");
  });
  it("excludes storage when cash is needed sooner", () => {
    const r = run({ ...buildScenarioLot("C", NOW), cashNeededWithinDays: 10 });
    expect(r.ineligible.find((o) => o.kind === "store")?.ineligibleReasons[0].code).toBe("cash_needed");
  });
});

describe("Scenario D — small farmer + FPO", () => {
  const r = run(buildScenarioLot("D", NOW));
  it("pooling beats shipping alone on net, with lower per-quintal transport", () => {
    expect(r.options[0].kind).toBe("fpo");
    expect(r.why.map((w) => w.code)).toContain("fpo_pooling");
    const dal = r.ineligible.find((o) => o.buyerId === "bd-dalmill");
    expect(dal?.ineligibleReasons.map((x) => x.code)).toContain("below_buyer_min");
  });
});

describe("Scenario E — missing data", () => {
  const r = run(buildScenarioLot("E", NOW));
  it("refuses to recommend confidently and lists what is missing", () => {
    expect(r.status).toBe("insufficient");
    const codes = r.missing.map((m) => m.code);
    expect(codes).toContain("feed_unavailable");
    expect(codes).toContain("feed_stale");
    expect(codes).toContain("cost_unknown");
    expect(codes).toContain("grade_unknown");
    expect(r.ineligible.find((o) => o.marketId === "nagpur")?.net).toBeNull();
  });
  it("recovers when the simulated gaps are switched off", () => {
    const fixed = run({ ...buildScenarioLot("E", NOW), ignoreScenarioGaps: true, gradeStatus: "verified" });
    expect(fixed.status).not.toBe("insufficient");
  });
});

describe("ranking edge cases", () => {
  it("applies farmer cost overrides and marks unknown overrides", () => {
    const lot = buildScenarioLot("A", NOW);
    const r = run({ ...lot, costOverrides: { "market:nagpur": { transport: 100 } } });
    expect(r.bestOptionId).toBe("market:nagpur");
    const r2 = run({ ...lot, costOverrides: { "market:wardha": { transport: null } } });
    const w = [...r2.options, ...r2.ineligible].find((o) => o.id === "market:wardha")!;
    expect(w.net!.isUpperBound).toBe(true);
    expect(w.quality).not.toBe("High");
  });
  it("flags options below the reserve price without hiding them", () => {
    const r = run({ ...buildScenarioLot("A", NOW), reservePricePerQtl: 4700 });
    const w = r.options.find((o) => o.id === "market:wardha")!;
    expect(w.flags.map((f) => f.code)).toContain("below_reserve");
    expect(r.whatCouldChange.map((x) => x.code)).toContain("reserve_not_met");
  });
  it("reports insufficient data when every feed is unavailable", () => {
    const s = defaultSettings();
    for (const k of Object.keys(s.feeds)) s.feeds[k] = { status: "unavailable", ageDays: 0 };
    const r = run({ ...buildScenarioLot("D", NOW) }, s);
    expect(r.status).toBe("insufficient");
    expect(r.bestOptionId).toBeNull();
  });
  it("honours the direct-buyer rule switch", () => {
    const s = defaultSettings();
    s.directBuyerAllowed = false;
    const r = run(buildScenarioLot("B", NOW), s);
    expect([...r.options, ...r.ineligible].some((o) => o.kind === "direct_buyer")).toBe(false);
  });
});
