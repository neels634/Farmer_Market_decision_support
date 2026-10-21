import { describe, expect, it } from "vitest";
import type { CostLine } from "@/lib/domain/types";
import { computeNet, rangeAround } from "@/lib/engine/net";
import { cheapestTransport } from "@/lib/engine/logistics";
import { DEFAULT_VEHICLES } from "@/lib/data/markets";

const cost = (key: CostLine["key"], perQtl: number | null): CostLine => ({
  key,
  group: "market",
  perQtl,
  basis: perQtl === null ? "unknown" : "assumption",
  detail: "",
  editable: true,
});

describe("computeNet", () => {
  it("reproduces the PRD worked example (Nagpur vs Wardha)", () => {
    const nagpur = computeNet(40, { low: 4720, expected: 4720, high: 4720 }, [cost("transport", 310), cost("otherCharges", 80)]);
    const wardha = computeNet(40, { low: 4610, expected: 4610, high: 4610 }, [cost("transport", 90), cost("otherCharges", 70)]);
    expect(nagpur.netPerQtl.expected).toBe(4330);
    expect(wardha.netPerQtl.expected).toBe(4450);
    expect(wardha.netPerQtl.expected - nagpur.netPerQtl.expected).toBe(120);
    expect(wardha.netTotal.expected - nagpur.netTotal.expected).toBe(4800);
  });

  it("scales totals linearly with quantity and keeps per-quintal values unchanged", () => {
    const price = { low: 4900, expected: 5000, high: 5100 };
    const lines = [cost("transport", 100), cost("hamali", 25)];
    const a = computeNet(10, price, lines);
    const b = computeNet(25, price, lines);
    expect(a.netPerQtl).toEqual(b.netPerQtl);
    expect(a.netTotal.expected).toBe(48750);
    expect(b.netTotal.expected).toBe(121875);
    expect(b.netTotal.low).toBe(4775 * 25);
    expect(b.netTotal.high).toBe(4975 * 25);
  });

  it("does not treat unknown costs as zero: flags them and marks the net as an upper bound", () => {
    const r = computeNet(10, { low: 5000, expected: 5000, high: 5000 }, [cost("transport", 100), cost("hamali", null)]);
    expect(r.unknownCostKeys).toEqual(["hamali"]);
    expect(r.isUpperBound).toBe(true);
    expect(r.knownCostPerQtl).toBe(100);
    expect(r.netPerQtl.expected).toBe(4900);
  });

  it("rejects duplicate cost keys to prevent double counting", () => {
    expect(() => computeNet(10, { low: 1, expected: 1, high: 1 }, [cost("transport", 10), cost("transport", 20)])).toThrow(/double-count/);
  });

  it("rejects non-positive quantity and negative costs", () => {
    expect(() => computeNet(0, { low: 1, expected: 1, high: 1 }, [])).toThrow();
    expect(() => computeNet(-5, { low: 1, expected: 1, high: 1 }, [])).toThrow();
    expect(() => computeNet(5, { low: 1, expected: 1, high: 1 }, [cost("transport", -1)])).toThrow();
  });

  it("rejects an inverted price range", () => {
    expect(() => computeNet(5, { low: 10, expected: 5, high: 20 }, [])).toThrow();
  });
});

describe("rangeAround", () => {
  it("builds a symmetric whole-rupee range", () => {
    expect(rangeAround(4520, 2)).toEqual({ low: 4430, expected: 4520, high: 4610 });
  });
});

describe("cheapestTransport", () => {
  it("picks the cheapest vehicle plan and spreads cost per quintal", () => {
    const q = cheapestTransport(8, 50, DEFAULT_VEHICLES);
    expect(q.vehicle.id).toBe("tempo");
    expect(q.trips).toBe(1);
    expect(q.totalCost).toBe(300 + 18 * 50);
    expect(q.perQtl).toBeCloseTo(150);
  });

  it("makes pooled lots cheaper per quintal than small individual lots", () => {
    const alone = cheapestTransport(8, 50, DEFAULT_VEHICLES);
    const pooled = cheapestTransport(74, 50, DEFAULT_VEHICLES);
    expect(pooled.vehicle.id).toBe("truck");
    expect(pooled.perQtl).toBeLessThan(alone.perQtl / 2);
  });

  it("uses multiple trips when the lot exceeds vehicle capacity", () => {
    const q = cheapestTransport(150, 30, DEFAULT_VEHICLES);
    expect(q.trips * q.vehicle.capacityQtl).toBeGreaterThanOrEqual(150);
  });
});
