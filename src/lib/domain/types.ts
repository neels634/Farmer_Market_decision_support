// Core domain types for the NetBhav decision engine.
// All money values are in ₹ (INR); all quantities are in quintals (1 qtl = 100 kg).

export type Lang = "en" | "hi" | "mr";
export type Localized = Record<Lang, string>;

/** Where a number came from. Every price/cost record carries one. */
export type DataKind = "live" | "historical" | "demo" | "illustrative";
export type FeedStatus = "ok" | "stale" | "unavailable";
export type QualityLevel = "High" | "Medium" | "Low";

export interface Provenance {
  sourceId: string;
  sourceName: string;
  kind: DataKind;
  /** ISO timestamp the record refers to (observation / posting time). */
  observedAt: string;
  status: FeedStatus;
  note?: string;
}

export type CommodityId = "orange" | "soybean" | "tur";
export type CropClass = "perishable" | "storable_oilseed" | "grain_pulse";
export type GradeStatus = "verified" | "declared" | "unknown";

export interface Grade {
  id: string;
  label: Localized;
  /** Multiplier applied to the market's reference (modal) price. Demo assumption. */
  priceFactor: number;
  description: Localized;
}

export interface Commodity {
  id: CommodityId;
  name: Localized;
  cropClass: CropClass;
  varieties: string[];
  grades: Grade[];
  defaultGradeId: string;
  /** Approximate ambient shelf life after harvest, in days. null = storable. Demo assumption. */
  shelfLifeDays: number | null;
  /** Value lost per day of delay after harvest (perishables), in % of price. Demo assumption. */
  spoilagePctPerDay: number;
  /** Value lost in transit per 100 km, in % of price. Demo assumption. */
  transitLossPctPer100Km: number;
  storage: {
    suitable: boolean;
    rentPerQtlPerMonth: number;
    lossPctPerMonth: number;
    handlingPerQtl: number;
  };
  packagingPerQtl: number;
  packagingLabel: Localized;
  hint: Localized;
}

export interface MarketCharges {
  /** Farmer-borne share of market fee, % of sale value. null = unknown. */
  marketFeePct: number | null;
  /** Unloading / hamali at market, ₹/qtl. null = unknown. */
  hamaliPerQtl: number | null;
  /** Weighing (tolai), ₹/qtl. null = unknown. */
  weighingPerQtl: number | null;
  /** Commission deducted from farmer, % of sale value. null = unknown. */
  commissionPct: number | null;
}

export interface Market {
  id: string;
  name: string;
  district: string;
  type: "APMC";
  lat: number;
  lng: number;
  commodities: CommodityId[];
  charges: MarketCharges;
}

export interface PriceObservation {
  marketId: string;
  commodityId: CommodityId;
  /** YYYY-MM-DD */
  date: string;
  minPrice: number;
  maxPrice: number;
  modalPrice: number;
  arrivalsQtl: number;
  bidders: number | null;
}

export interface MarketFeed {
  marketId: string;
  commodityId: CommodityId;
  latest: PriceObservation | null;
  history: PriceObservation[];
  provenance: Provenance;
  ageDays: number | null;
}

export interface DemoLocation {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
}

export interface Vehicle {
  id: "tempo" | "pickup" | "truck";
  label: Localized;
  capacityQtl: number;
  fixedPerTrip: number;
  perKm: number;
}

export type BuyerReliability = "High" | "Medium" | "Low";

export interface BuyerDemand {
  id: string;
  buyerName: string;
  buyerType: "processor" | "trader" | "exporter" | "retail_chain";
  commodityId: CommodityId;
  acceptedGradeIds: string[];
  minQtl: number;
  maxQtl: number;
  pricePerQtl: number;
  /** farm_gate = buyer collects; delivered = farmer delivers to buyer location. */
  terms: "farm_gate" | "delivered";
  lat: number;
  lng: number;
  locationName: string;
  paymentDays: number;
  reliability: BuyerReliability;
  requiredBy: string; // YYYY-MM-DD
  postedAt: string; // ISO
  provenance: Provenance;
  createdInDemo?: boolean;
}

export interface FpoMemberLot {
  id: string;
  farmerLabel: string;
  quantityQtl: number;
  locationName: string;
}

export interface Fpo {
  id: string;
  name: string;
  locationName: string;
  lat: number;
  lng: number;
  commodities: CommodityId[];
  serviceFeePerQtl: number;
  collectionPerQtl: number;
  poolingDelayDays: number;
  members: Partial<Record<CommodityId, FpoMemberLot[]>>;
  provenance: Provenance;
}

export type RiskPreference = "cautious" | "balanced" | "patient";

export interface ProduceLot {
  id: string;
  createdAt: string;
  commodityId: CommodityId;
  variety: string;
  quantityQtl: number;
  gradeId: string;
  gradeStatus: GradeStatus;
  locationId: string | null;
  customLocation?: { lat: number; lng: number; label: string } | null;
  harvestDate: string; // YYYY-MM-DD
  availableFrom: string; // YYYY-MM-DD
  radiusKm: number;
  storageDays: number;
  reservePricePerQtl?: number | null;
  cashNeededWithinDays?: number | null;
  riskPreference: RiskPreference;
  notes?: string;
  scenarioId?: string | null;
  /** When true, a scenario's simulated data gaps (stale/unavailable feeds) are switched off. */
  ignoreScenarioGaps?: boolean;
  /** Per-option, per-cost-line manual edits made by the farmer. null = mark as unknown. */
  costOverrides?: Record<string, Partial<Record<CostKey, number | null>>>;
}

export type CostKey =
  | "transport"
  | "farmLoading"
  | "packaging"
  | "hamali"
  | "weighing"
  | "marketFee"
  | "commission"
  | "transitLoss"
  | "spoilage"
  | "storageRent"
  | "storageLoss"
  | "storageHandling"
  | "waitingCost"
  | "fpoCollection"
  | "fpoFee"
  | "paymentRisk"
  | "otherCharges";

export type CostBasis = "computed" | "assumption" | "override" | "illustrative" | "unknown";

export interface CostLine {
  key: CostKey;
  group: "transport" | "handling" | "market" | "quality" | "storage" | "other";
  /** ₹ per quintal. null means the value is unknown (never silently zero). */
  perQtl: number | null;
  basis: CostBasis;
  /** Human-readable working, e.g. "1 × truck, 75 km: ₹1,200 + ₹55/km". */
  detail: string;
  editable: boolean;
}

export interface PriceRange {
  low: number;
  expected: number;
  high: number;
}

export interface NetResult {
  quantityQtl: number;
  price: PriceRange;
  costs: CostLine[];
  knownCostPerQtl: number;
  unknownCostKeys: CostKey[];
  netPerQtl: PriceRange;
  netTotal: PriceRange;
  /** True when some cost is unknown, so the net shown is an upper bound. */
  isUpperBound: boolean;
}

export type OptionKind = "sell_nearby" | "move" | "store" | "fpo" | "direct_buyer";

export interface QualityReason {
  code: string;
  params?: Record<string, string | number>;
  impact: "down" | "info";
}

export interface RecommendationOption {
  id: string;
  kind: OptionKind;
  title: string;
  marketId?: string;
  buyerId?: string;
  fpoId?: string;
  distanceKm: number | null;
  sellAfterDays: number;
  priceBasis: string;
  /** null only for ineligible options that have no usable price. */
  net: NetResult | null;
  provenance: Provenance[];
  quality: QualityLevel;
  qualityReasons: QualityReason[];
  eligible: boolean;
  ineligibleReasons: QualityReason[];
  flags: QualityReason[];
  vehicleSummary?: string;
  rank?: number;
}

export interface ExplanationItem {
  code: string;
  params: Record<string, string | number>;
}

export type RecommendationStatus = "confident" | "tentative" | "insufficient";

export interface Recommendation {
  lotId: string;
  generatedAt: string;
  status: RecommendationStatus;
  bestOptionId: string | null;
  runnerUpOptionId: string | null;
  options: RecommendationOption[]; // eligible, ranked
  ineligible: RecommendationOption[];
  why: ExplanationItem[];
  whatCouldChange: ExplanationItem[];
  assumptions: ExplanationItem[];
  missing: ExplanationItem[];
  diffVsRunnerUp: { perQtl: number; total: number } | null;
  remainingShelfLifeDays: number | null;
  /** Sell-now vs store-for-N-days curve (storable crops only). */
  storageCurve: StoragePoint[] | null;
  riskWeight: number;
  stats: {
    optionsCompared: number;
    optionsWithCompleteCosts: number;
    optionsWithProvenance: number;
    staleOrMissingFeeds: number;
    feedsConsidered: number;
  };
}

export interface StoragePoint {
  days: number;
  net: PriceRange;
  quality: QualityLevel;
  marketName: string;
}

export interface FeedSetting {
  status: FeedStatus;
  ageDays: number;
}

export interface DemoSettings {
  /** Keyed by marketId. Applies to all commodities at that market. */
  feeds: Record<string, FeedSetting>;
  vehicles: Vehicle[];
  farmLoadingPerQtl: number;
  monthlyInterestPct: number;
  directBuyerAllowed: boolean;
  roadFactor: number;
  sameDayMaxKm: number;
}

export interface SavedDecision {
  id: string;
  lotId: string;
  optionId: string | null;
  optionTitle: string;
  action: "accepted" | "rejected" | "saved";
  netPerQtl: number | null;
  netTotal: number | null;
  reservePricePerQtl: number | null;
  savedAt: string;
}
