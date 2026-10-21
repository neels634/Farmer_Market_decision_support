import type { Fpo, Market, Vehicle } from "@/lib/domain/types";
import { cheapestTransport, roadKm, type TransportQuote } from "@/lib/engine/logistics";

// FPO aggregation calculator: compares each member shipping alone against
// pooling into one lot. Uses the same transport model as the farmer engine.

export interface AggregationInput {
  fpo: Fpo;
  members: { id: string; label: string; quantityQtl: number }[];
  destination: Market;
  vehicles: Vehicle[];
  roadFactor: number;
  serviceFeePerQtl: number;
  collectionPerQtl: number;
  /** Extra km each member travels to reach the FPO centre when shipping alone (demo assumption). */
  memberOffsetKm: number;
}

export interface MemberComparison {
  id: string;
  label: string;
  quantityQtl: number;
  alone: TransportQuote;
  alonePerQtl: number;
  pooledPerQtl: number;
  savingPerQtl: number;
  savingTotal: number;
}

export interface AggregationResult {
  km: number;
  pooledQty: number;
  pooled: TransportQuote | null;
  pooledTransportPerQtl: number;
  members: MemberComparison[];
  totalSaving: number;
  avgAlonePerQtl: number;
  avgPooledPerQtl: number;
}

export function compareAggregation(input: AggregationInput): AggregationResult {
  const km = roadKm(input.fpo, input.destination, input.roadFactor);
  const pooledQty = input.members.reduce((s, m) => s + m.quantityQtl, 0);
  if (pooledQty <= 0) {
    return { km, pooledQty: 0, pooled: null, pooledTransportPerQtl: 0, members: [], totalSaving: 0, avgAlonePerQtl: 0, avgPooledPerQtl: 0 };
  }
  const pooled = cheapestTransport(pooledQty, km, input.vehicles);
  const pooledPerQtl = pooled.perQtl + input.collectionPerQtl + input.serviceFeePerQtl;
  const members = input.members.map((m) => {
    const alone = cheapestTransport(m.quantityQtl, km + input.memberOffsetKm, input.vehicles);
    const savingPerQtl = alone.perQtl - pooledPerQtl;
    return {
      id: m.id,
      label: m.label,
      quantityQtl: m.quantityQtl,
      alone,
      alonePerQtl: alone.perQtl,
      pooledPerQtl,
      savingPerQtl,
      savingTotal: savingPerQtl * m.quantityQtl,
    };
  });
  const totalAlone = members.reduce((s, m) => s + m.alone.totalCost, 0);
  return {
    km,
    pooledQty,
    pooled,
    pooledTransportPerQtl: pooled.perQtl,
    members,
    totalSaving: members.reduce((s, m) => s + m.savingTotal, 0),
    avgAlonePerQtl: totalAlone / pooledQty,
    avgPooledPerQtl: pooledPerQtl,
  };
}
