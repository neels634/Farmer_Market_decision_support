import type { CommodityId, DemoLocation, DemoSettings, Market, Vehicle } from "@/lib/domain/types";

// Market names and approximate coordinates refer to real APMC towns in the
// Nagpur region. Their CHARGES and PRICES in this app are demo values only.
// Charges represent an assumed farmer-borne share; actual charges and who
// bears them vary by market and must be verified locally.

const std = (fee: number, hamali: number, weighing: number) => ({
  marketFeePct: fee,
  hamaliPerQtl: hamali,
  weighingPerQtl: weighing,
  commissionPct: 0,
});

export const MARKETS: Market[] = [
  { id: "nagpur", name: "Nagpur (Kalamna)", district: "Nagpur", type: "APMC", lat: 21.165, lng: 79.125, commodities: ["orange", "soybean", "tur"], charges: std(1.0, 30, 10) },
  { id: "wardha", name: "Wardha", district: "Wardha", type: "APMC", lat: 20.745, lng: 78.602, commodities: ["soybean", "tur"], charges: std(0.8, 25, 8) },
  { id: "katol", name: "Katol", district: "Nagpur", type: "APMC", lat: 21.272, lng: 78.586, commodities: ["orange", "soybean", "tur"], charges: std(0.8, 25, 6) },
  { id: "kalmeshwar", name: "Kalmeshwar", district: "Nagpur", type: "APMC", lat: 21.232, lng: 78.919, commodities: ["orange", "soybean", "tur"], charges: std(0.8, 24, 6) },
  { id: "saoner", name: "Saoner", district: "Nagpur", type: "APMC", lat: 21.385, lng: 78.921, commodities: ["orange", "soybean", "tur"], charges: std(0.8, 26, 6) },
  { id: "umred", name: "Umred", district: "Nagpur", type: "APMC", lat: 20.851, lng: 79.326, commodities: ["soybean", "tur"], charges: std(0.8, 24, 6) },
  { id: "hinganghat", name: "Hinganghat", district: "Wardha", type: "APMC", lat: 20.548, lng: 78.839, commodities: ["soybean", "tur"], charges: std(0.9, 27, 8) },
  { id: "amravati", name: "Amravati", district: "Amravati", type: "APMC", lat: 20.937, lng: 77.779, commodities: ["orange", "soybean", "tur"], charges: std(1.0, 30, 10) },
  { id: "warud", name: "Warud", district: "Amravati", type: "APMC", lat: 21.471, lng: 78.269, commodities: ["orange", "soybean"], charges: std(0.8, 25, 6) },
  { id: "ramtek", name: "Ramtek", district: "Nagpur", type: "APMC", lat: 21.395, lng: 79.327, commodities: ["soybean", "tur"], charges: std(0.8, 24, 6) },
];

export const MARKET_BY_ID: Record<string, Market> = Object.fromEntries(MARKETS.map((m) => [m.id, m]));

/** Reference (modal) prices for the demo feed, ₹/qtl. SIMULATED — not current market prices. */
export const DEMO_MODAL_PRICES: Record<string, Partial<Record<CommodityId, number>>> = {
  nagpur: { orange: 3500, soybean: 4560, tur: 7150 },
  wardha: { soybean: 4500, tur: 7050 },
  katol: { orange: 3250, soybean: 4470, tur: 6980 },
  kalmeshwar: { orange: 3200, soybean: 4440, tur: 6950 },
  saoner: { orange: 3300, soybean: 4480, tur: 7000 },
  umred: { soybean: 4180, tur: 6900 },
  hinganghat: { soybean: 4520, tur: 7080 },
  amravati: { orange: 3600, soybean: 4600, tur: 7200 },
  warud: { orange: 3350, soybean: 4430 },
  ramtek: { soybean: 4410, tur: 6920 },
};

export const DEMO_LOCATIONS: DemoLocation[] = [
  { id: "seloo", name: "Seloo area", district: "Wardha", lat: 20.835, lng: 78.705 },
  { id: "katol-area", name: "Katol area", district: "Nagpur", lat: 21.29, lng: 78.6 },
  { id: "kalmeshwar-area", name: "Kalmeshwar area", district: "Nagpur", lat: 21.25, lng: 78.9 },
  { id: "hinganghat-area", name: "Hinganghat area", district: "Wardha", lat: 20.57, lng: 78.82 },
  { id: "umred-area", name: "Umred area", district: "Nagpur", lat: 20.87, lng: 79.3 },
  { id: "narkhed-area", name: "Narkhed area", district: "Nagpur", lat: 21.468, lng: 78.535 },
  { id: "hingna-area", name: "Hingna area", district: "Nagpur", lat: 21.078, lng: 78.958 },
];

export const LOCATION_BY_ID: Record<string, DemoLocation> = Object.fromEntries(DEMO_LOCATIONS.map((l) => [l.id, l]));

export const DEFAULT_VEHICLES: Vehicle[] = [
  { id: "tempo", label: { en: "Tempo (10 qtl)", hi: "टेम्पो (10 क्विं.)", mr: "टेम्पो (10 क्विं.)" }, capacityQtl: 10, fixedPerTrip: 300, perKm: 18 },
  { id: "pickup", label: { en: "Pickup (25 qtl)", hi: "पिकअप (25 क्विं.)", mr: "पिकअप (25 क्विं.)" }, capacityQtl: 25, fixedPerTrip: 500, perKm: 26 },
  { id: "truck", label: { en: "Truck (100 qtl)", hi: "ट्रक (100 क्विं.)", mr: "ट्रक (100 क्विं.)" }, capacityQtl: 100, fixedPerTrip: 1200, perKm: 55 },
];

export function defaultSettings(): DemoSettings {
  return {
    feeds: Object.fromEntries(MARKETS.map((m) => [m.id, { status: "ok" as const, ageDays: 1 }])),
    vehicles: DEFAULT_VEHICLES.map((v) => ({ ...v })),
    farmLoadingPerQtl: 10,
    monthlyInterestPct: 1.0,
    directBuyerAllowed: true,
    roadFactor: 1.3,
    sameDayMaxKm: 100,
  };
}

/**
 * Demo seasonal price index by calendar month (Jan = index 0), relative scale.
 * Represents a typical post-harvest dip and later recovery. SIMULATED pattern,
 * used only to produce a labelled reference range for storage decisions.
 */
export const SEASONAL_INDEX: Record<CommodityId, number[]> = {
  soybean: [1.01, 1.03, 1.02, 1.01, 1.0, 1.0, 0.99, 0.98, 0.96, 0.94, 0.95, 0.98],
  tur: [0.95, 0.96, 0.98, 1.0, 1.02, 1.03, 1.04, 1.04, 1.03, 1.01, 0.99, 0.96],
  orange: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};

/** Monthly volatility used to widen the storage range with time. Demo assumption. */
export const MONTHLY_VOLATILITY_PCT: Record<CommodityId, number> = { soybean: 4, tur: 4.5, orange: 8 };
