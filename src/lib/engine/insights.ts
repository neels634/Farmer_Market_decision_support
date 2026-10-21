import type { BuyerDemand, CommodityId, DataKind, MarketFeed, ProduceLot } from "@/lib/domain/types";
import { MARKET_BY_ID } from "@/lib/data/markets";
import { resolveOrigin } from "@/lib/engine/recommend";
import { roadKm } from "@/lib/engine/logistics";

// Experimental, rule-based indicators over the DEMO feed. These are simple
// statistics, not a trained anomaly model.

export interface Anomaly {
  marketId: string;
  commodityId: CommodityId;
  kind: "price_drop" | "price_spike" | "low_competition" | "arrival_spike";
  value: number;
  detail: string;
}

export function pctChange(feed: MarketFeed, days: number): number | null {
  const h = feed.history;
  if (h.length <= days) return null;
  const a = h[h.length - 1 - days].modalPrice;
  const b = h[h.length - 1].modalPrice;
  return ((b - a) / a) * 100;
}

function mean(xs: number[]) {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}
function std(xs: number[]) {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function detectAnomalies(feeds: MarketFeed[]): Anomaly[] {
  const out: Anomaly[] = [];
  const byCommodity = new Map<CommodityId, MarketFeed[]>();
  for (const f of feeds) {
    if (!f.latest) continue;
    byCommodity.set(f.commodityId, [...(byCommodity.get(f.commodityId) ?? []), f]);
  }
  for (const f of feeds) {
    if (!f.latest || f.history.length < 20) continue;
    const h = f.history;
    const changes = h.slice(1).map((o, i) => ((o.modalPrice - h[i].modalPrice) / h[i].modalPrice) * 100);
    const last = changes[changes.length - 1];
    const prior = changes.slice(-31, -1);
    const sd = std(prior) || 0.1;
    const z = (last - mean(prior)) / sd;
    if (Math.abs(z) > 3) {
      out.push({
        marketId: f.marketId,
        commodityId: f.commodityId,
        kind: last < 0 ? "price_drop" : "price_spike",
        value: Math.round(last * 10) / 10,
        detail: `Last-day change ${last.toFixed(1)}% is ${Math.abs(z).toFixed(1)}× the usual daily variation`,
      });
    }
    const peers = (byCommodity.get(f.commodityId) ?? []).map((p) => p.latest!.modalPrice);
    const med = median(peers);
    if (f.latest.bidders !== null && f.latest.bidders <= 4 && f.latest.modalPrice < med * 0.95) {
      out.push({
        marketId: f.marketId,
        commodityId: f.commodityId,
        kind: "low_competition",
        value: f.latest.bidders,
        detail: `Only ${f.latest.bidders} bidders and modal price ${(((med - f.latest.modalPrice) / med) * 100).toFixed(1)}% below the regional median`,
      });
    }
    const avgArr = mean(h.slice(-15, -1).map((o) => o.arrivalsQtl));
    const ratio = f.latest.arrivalsQtl / avgArr;
    if (ratio > 1.6) {
      out.push({
        marketId: f.marketId,
        commodityId: f.commodityId,
        kind: "arrival_spike",
        value: Math.round(ratio * 10) / 10,
        detail: `Arrivals ${ratio.toFixed(1)}× the 14-day average — possible supply pressure`,
      });
    }
  }
  return out;
}

export interface Alert {
  id: string;
  kind: "price_move" | "buyer_demand" | "arrivals" | "stale_data";
  lotId: string;
  dataKind: DataKind;
  params: Record<string, string | number>;
}

export function buildAlerts(
  lots: ProduceLot[],
  feedsByCommodity: Partial<Record<CommodityId, MarketFeed[]>>,
  demands: BuyerDemand[],
  roadFactor: number,
): Alert[] {
  const alerts: Alert[] = [];
  for (const lot of lots) {
    const origin = resolveOrigin(lot);
    const feeds = (feedsByCommodity[lot.commodityId] ?? []).filter((f) => {
      const m = MARKET_BY_ID[f.marketId];
      return roadKm(origin, m, roadFactor) <= lot.radiusKm;
    });
    for (const f of feeds) {
      const m = MARKET_BY_ID[f.marketId];
      if (!f.latest || f.provenance.status !== "ok") {
        alerts.push({
          id: `${lot.id}:stale:${f.marketId}`,
          kind: "stale_data",
          lotId: lot.id,
          dataKind: "demo",
          params: { market: m.name, status: f.provenance.status, days: f.ageDays ?? 0 },
        });
        continue;
      }
      const ch = pctChange(f, 7);
      if (ch !== null && Math.abs(ch) >= 4) {
        alerts.push({ id: `${lot.id}:move:${f.marketId}`, kind: "price_move", lotId: lot.id, dataKind: "demo", params: { market: m.name, pct: Math.round(ch * 10) / 10 } });
      }
      const h = f.history;
      const avgArr = mean(h.slice(-15, -1).map((o) => o.arrivalsQtl));
      if (f.latest.arrivalsQtl / avgArr > 1.6) {
        alerts.push({
          id: `${lot.id}:arr:${f.marketId}`,
          kind: "arrivals",
          lotId: lot.id,
          dataKind: "demo",
          params: { market: m.name, ratio: Math.round((f.latest.arrivalsQtl / avgArr) * 10) / 10 },
        });
      }
    }
    for (const d of demands) {
      if (d.commodityId !== lot.commodityId) continue;
      if (lot.gradeStatus !== "unknown" && !d.acceptedGradeIds.includes(lot.gradeId)) continue;
      if (lot.quantityQtl < d.minQtl || lot.quantityQtl > d.maxQtl) continue;
      const km = roadKm(origin, d, roadFactor);
      if (km > lot.radiusKm) continue;
      alerts.push({
        id: `${lot.id}:buyer:${d.id}`,
        kind: "buyer_demand",
        lotId: lot.id,
        dataKind: "demo",
        params: { buyer: d.buyerName, price: d.pricePerQtl, km: Math.round(km) },
      });
    }
  }
  return alerts;
}
