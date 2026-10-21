import type { CostKey, CostLine, NetResult, PriceRange } from "@/lib/domain/types";

/**
 * Net farmer realisation — the single source of truth for the arithmetic.
 *
 *   net = expected sale value − Σ known cost lines   (all ₹/qtl)
 *
 * Unknown cost lines (perQtl === null) are never treated as zero: they are
 * reported in `unknownCostKeys` and the result is flagged as an upper bound.
 * Each cost key may appear only once per option, to prevent double counting.
 */
export function computeNet(quantityQtl: number, price: PriceRange, costs: CostLine[]): NetResult {
  if (!Number.isFinite(quantityQtl) || quantityQtl <= 0) {
    throw new Error("Quantity must be a positive number of quintals");
  }
  if (!(price.low <= price.expected && price.expected <= price.high)) {
    throw new Error("Price range must satisfy low ≤ expected ≤ high");
  }
  const seen = new Set<CostKey>();
  for (const c of costs) {
    if (seen.has(c.key)) throw new Error(`Duplicate cost line "${c.key}" would double-count a cost`);
    seen.add(c.key);
    if (c.perQtl !== null && (!Number.isFinite(c.perQtl) || c.perQtl < 0)) {
      throw new Error(`Cost line "${c.key}" must be a non-negative number or unknown`);
    }
  }

  const knownCostPerQtl = costs.reduce((sum, c) => sum + (c.perQtl ?? 0), 0);
  const unknownCostKeys = costs.filter((c) => c.perQtl === null).map((c) => c.key);

  const netPerQtl: PriceRange = {
    low: price.low - knownCostPerQtl,
    expected: price.expected - knownCostPerQtl,
    high: price.high - knownCostPerQtl,
  };

  return {
    quantityQtl,
    price,
    costs,
    knownCostPerQtl,
    unknownCostKeys,
    netPerQtl,
    netTotal: scaleRange(netPerQtl, quantityQtl),
    isUpperBound: unknownCostKeys.length > 0,
  };
}

export function scaleRange(r: PriceRange, factor: number): PriceRange {
  return { low: r.low * factor, expected: r.expected * factor, high: r.high * factor };
}

/** Symmetric range around an expected value, in whole rupees. */
export function rangeAround(expected: number, widthPct: number): PriceRange {
  const e = Math.round(expected);
  const d = Math.round((e * widthPct) / 100);
  return { low: e - d, expected: e, high: e + d };
}

/** Round a ₹/qtl figure to whole rupees for cost lines (keeps sums consistent with display). */
export function rupees(n: number): number {
  return Math.round(n);
}
