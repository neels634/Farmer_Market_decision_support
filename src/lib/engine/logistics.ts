import type { Vehicle } from "@/lib/domain/types";

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Estimated road distance = straight-line distance × road factor (demo assumption, no routing service). */
export function roadKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }, roadFactor: number): number {
  return Math.round(haversineKm(a, b) * roadFactor * 10) / 10;
}

export interface TransportQuote {
  vehicle: Vehicle;
  trips: number;
  tripCost: number;
  totalCost: number;
  perQtl: number;
  km: number;
  quantityQtl: number;
}

/**
 * Cheapest single-vehicle-type plan for moving `quantityQtl` over `km`.
 * Trip cost = fixed charge + per-km rate × one-way distance (rate includes return).
 */
export function cheapestTransport(quantityQtl: number, km: number, vehicles: Vehicle[]): TransportQuote {
  if (quantityQtl <= 0) throw new Error("Quantity must be positive");
  if (vehicles.length === 0) throw new Error("No vehicles configured");
  let best: TransportQuote | null = null;
  for (const v of vehicles) {
    const trips = Math.ceil(quantityQtl / v.capacityQtl);
    const tripCost = v.fixedPerTrip + v.perKm * km;
    const totalCost = trips * tripCost;
    if (!best || totalCost < best.totalCost) {
      best = { vehicle: v, trips, tripCost, totalCost, perQtl: totalCost / quantityQtl, km, quantityQtl };
    }
  }
  return best!;
}

export function describeTransport(q: TransportQuote): string {
  const used = Math.round((q.quantityQtl / (q.trips * q.vehicle.capacityQtl)) * 100);
  return `${q.trips} × ${q.vehicle.label.en} for ${q.km} km: ${q.trips} × (₹${q.vehicle.fixedPerTrip} + ₹${q.vehicle.perKm}/km × ${q.km} km) = ₹${Math.round(q.totalCost).toLocaleString("en-IN")} ÷ ${q.quantityQtl} qtl (vehicle ${used}% full)`;
}
