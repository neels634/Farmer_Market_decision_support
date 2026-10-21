import type {
  BuyerDemand,
  BuyerReliability,
  Commodity,
  CostKey,
  CostLine,
  DataKind,
  DemoSettings,
  ExplanationItem,
  Fpo,
  Market,
  MarketCharges,
  MarketFeed,
  ProduceLot,
  QualityLevel,
  QualityReason,
  Recommendation,
  RecommendationOption,
  RecommendationStatus,
  RiskPreference,
  StoragePoint,
} from "@/lib/domain/types";
import { COMMODITIES, getGrade } from "@/lib/data/commodities";
import { LOCATION_BY_ID, MARKETS, MONTHLY_VOLATILITY_PCT, SEASONAL_INDEX } from "@/lib/data/markets";
import { SCENARIO_BY_ID, type ScenarioConfig } from "@/lib/data/scenarios";
import { demoFeedAdapter } from "@/lib/data/sources";
import { addDays, dateOnly, daysBetween, monthIndex } from "@/lib/domain/dates";
import { cheapestTransport, describeTransport, roadKm } from "@/lib/engine/logistics";
import { computeNet, rangeAround, rupees } from "@/lib/engine/net";

// ---------------------------------------------------------------------------
// Rule-based, deterministic recommendation engine. Every number it produces
// can be traced to a cost line, a data record or a named demo assumption.
// It is NOT a trained or validated ML model.
// ---------------------------------------------------------------------------

export interface EngineInput {
  lot: ProduceLot;
  settings: DemoSettings;
  now: Date;
  buyerDemands: BuyerDemand[];
  fpos: Fpo[];
}

/** Weight on downside spread when ranking: score = expected net − w × (expected − low). */
export const RISK_WEIGHT: Record<RiskPreference, number> = { cautious: 0.5, balanced: 0.25, patient: 0 };
/** Day-to-day modal price variation applied to every price (demo assumption). */
export const BASE_RANGE_PCT = 2;
export const AGING_RANGE_PCT = 3;
export const STALE_RANGE_PCT = 6;
export const UNKNOWN_GRADE_RANGE_PCT = 5;
/** Expected loss allowance for buyer payment risk, % of value (demo assumption). */
export const PAYMENT_RISK_PCT: Record<BuyerReliability, number> = { High: 0.5, Medium: 2, Low: 5 };
export const BUYER_UNLOADING_PER_QTL = 15;
export const STORAGE_HORIZONS = [0, 30, 60, 90, 120];
export const FPO_COLLECTION_RADIUS_KM = 25;

const PRICE_PROPORTIONAL: CostKey[] = ["marketFee", "commission", "transitLoss", "spoilage", "storageLoss", "paymentRisk"];

interface Ctx {
  lot: ProduceLot;
  commodity: Commodity;
  gradeFactor: number;
  settings: DemoSettings;
  now: Date;
  today: string;
  saleBase: string;
  baseDelayDays: number;
  origin: { lat: number; lng: number; label: string };
  scenario: ScenarioConfig | null;
  gaps: boolean;
  markets: Market[];
  feeds: Map<string, MarketFeed>;
}

export function resolveOrigin(lot: ProduceLot): { lat: number; lng: number; label: string } {
  if (lot.customLocation) return lot.customLocation;
  const loc = lot.locationId ? LOCATION_BY_ID[lot.locationId] : undefined;
  if (!loc) throw new Error("Lot has no valid location");
  return { lat: loc.lat, lng: loc.lng, label: loc.name };
}

/** Settings after applying a scenario's simulated data gaps (unless switched off). */
export function effectiveSettings(lot: ProduceLot, settings: DemoSettings): DemoSettings {
  const scenario = lot.scenarioId ? SCENARIO_BY_ID[lot.scenarioId] : null;
  if (!scenario?.feedOverrides || lot.ignoreScenarioGaps) return settings;
  return { ...settings, feeds: { ...settings.feeds, ...scenario.feedOverrides } };
}

function buildCtx(input: EngineInput): Ctx {
  const { lot, now } = input;
  const commodity = COMMODITIES[lot.commodityId];
  const scenario = lot.scenarioId ? SCENARIO_BY_ID[lot.scenarioId] ?? null : null;
  const settings = effectiveSettings(lot, input.settings);
  const today = dateOnly(now);
  const saleBase = lot.availableFrom > today ? lot.availableFrom : today;
  const markets = MARKETS.filter(
    (m) => m.commodities.includes(lot.commodityId) && (!scenario?.marketIds || scenario.marketIds.includes(m.id)),
  );
  const feeds = new Map<string, MarketFeed>();
  for (const m of markets) {
    const f = demoFeedAdapter.getFeed(m.id, lot.commodityId, settings, now);
    if (f) feeds.set(m.id, f);
  }
  return {
    lot,
    commodity,
    gradeFactor: getGrade(lot.commodityId, lot.gradeId).priceFactor,
    settings,
    now,
    today,
    saleBase,
    baseDelayDays: daysBetween(today, saleBase),
    origin: resolveOrigin(lot),
    scenario,
    gaps: !!scenario && !lot.ignoreScenarioGaps,
    markets,
    feeds,
  };
}

// ---- helpers ----------------------------------------------------------------

function line(
  key: CostKey,
  group: CostLine["group"],
  perQtl: number | null,
  basis: CostLine["basis"],
  detail: string,
  editable = true,
): CostLine {
  return { key, group, perQtl: perQtl === null ? null : rupees(perQtl), basis: perQtl === null ? "unknown" : basis, detail, editable };
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function applyOverrides(optionId: string, lines: CostLine[], lot: ProduceLot): CostLine[] {
  const o = lot.costOverrides?.[optionId];
  if (!o) return lines;
  return lines.map((l) => {
    if (!(l.key in o)) return l;
    const v = o[l.key];
    const was = l.perQtl === null ? "unknown" : inr(l.perQtl);
    return v === null || v === undefined
      ? { ...l, perQtl: null, basis: "unknown", detail: `Marked unknown by you (was ${was})` }
      : { ...l, perQtl: rupees(v), basis: "override", detail: `Edited by you (calculated value was ${was})` };
  });
}

function chargesFor(ctx: Ctx, market: Market): MarketCharges {
  const o = ctx.gaps ? ctx.scenario?.chargeOverrides?.[market.id] : undefined;
  return { ...market.charges, ...(o ?? {}) };
}

function isStale(feed: MarketFeed) {
  return feed.provenance.status === "stale";
}

function priceWidthPct(ctx: Ctx, feed: MarketFeed | null): number {
  let w = BASE_RANGE_PCT;
  if (feed) {
    if (isStale(feed)) w += STALE_RANGE_PCT;
    else if ((feed.ageDays ?? 0) >= 3) w += AGING_RANGE_PCT;
  }
  if (ctx.lot.gradeStatus === "unknown") w += UNKNOWN_GRADE_RANGE_PCT;
  return w;
}

function shelfLifeReason(ctx: Ctx, sellAfterDays: number): QualityReason | null {
  const shelf = ctx.commodity.shelfLifeDays;
  if (shelf == null) return null;
  const days = daysBetween(ctx.lot.harvestDate, addDays(ctx.today, sellAfterDays));
  return days > shelf ? { code: "shelf_life_exceeded", params: { days, shelf }, impact: "down" } : null;
}

function daysSinceHarvestAt(ctx: Ctx, sellAfterDays: number) {
  return Math.max(0, daysBetween(ctx.lot.harvestDate, addDays(ctx.today, sellAfterDays)));
}

/** Market-side and handling costs shared by every option that ends in an APMC sale. */
function marketSideCosts(ctx: Ctx, charges: MarketCharges, price: number, km: number, sellAfterDays: number): CostLine[] {
  const c = ctx.commodity;
  const lines: CostLine[] = [
    line("farmLoading", "handling", ctx.settings.farmLoadingPerQtl, "assumption", "Loading at farm (demo labour rate)"),
    line("packaging", "handling", c.packagingPerQtl, "assumption", `${c.packagingLabel.en} (demo rate)`),
    line(
      "hamali",
      "market",
      charges.hamaliPerQtl,
      "assumption",
      charges.hamaliPerQtl === null ? "Unloading charge not available for this market" : "Unloading / hamali at market (demo rate)",
    ),
    line(
      "weighing",
      "market",
      charges.weighingPerQtl,
      "assumption",
      charges.weighingPerQtl === null ? "Weighing charge not available" : "Weighing at market (demo rate)",
    ),
    line(
      "marketFee",
      "market",
      charges.marketFeePct === null ? null : (charges.marketFeePct / 100) * price,
      "assumption",
      charges.marketFeePct === null
        ? "Market fee not available for this market"
        : `${charges.marketFeePct}% of ${inr(price)} (assumed farmer-borne share — verify locally)`,
    ),
    line(
      "commission",
      "market",
      charges.commissionPct === null ? null : (charges.commissionPct / 100) * price,
      "assumption",
      charges.commissionPct === 0
        ? "No commission deduction from the farmer assumed; edit if your market differs"
        : charges.commissionPct === null
          ? "Commission not known"
          : `${charges.commissionPct}% of ${inr(price)}`,
    ),
  ];
  lines.push(...perishableLosses(ctx, price, km, sellAfterDays));
  return lines;
}

function perishableLosses(ctx: Ctx, price: number, km: number, sellAfterDays: number): CostLine[] {
  const c = ctx.commodity;
  if (c.cropClass !== "perishable") return [];
  const transitPct = (c.transitLossPctPer100Km * km) / 100;
  const days = daysSinceHarvestAt(ctx, sellAfterDays);
  const spoilPct = c.spoilagePctPerDay * days;
  return [
    line(
      "transitLoss",
      "quality",
      (transitPct / 100) * price,
      "assumption",
      `${transitPct.toFixed(2)}% value lost over ${km} km (${c.transitLossPctPer100Km}%/100 km, demo rate)`,
    ),
    line(
      "spoilage",
      "quality",
      (spoilPct / 100) * price,
      "assumption",
      `${days} day(s) from harvest to sale × ${c.spoilagePctPerDay}%/day (demo rate)`,
    ),
  ];
}

interface QualityInput {
  feed?: MarketFeed | null;
  kind: DataKind;
  unknownCosts: CostKey[];
  forecastMonths?: number;
  reliability?: BuyerReliability;
  simulated?: "buyer" | "fpo";
  postingAgeDays?: number;
}

export function assessQuality(ctx: Pick<Ctx, "lot">, q: QualityInput): { quality: QualityLevel; reasons: QualityReason[] } {
  let score = 3;
  const reasons: QualityReason[] = [];
  if (q.feed) {
    const age = q.feed.ageDays ?? 0;
    if (isStale(q.feed)) {
      score = Math.min(score, 1);
      reasons.push({ code: "price_stale", params: { days: age }, impact: "down" });
    } else if (age >= 3) {
      score -= 1;
      reasons.push({ code: "price_aging", params: { days: age }, impact: "down" });
    } else {
      reasons.push({ code: "price_fresh", params: { days: age }, impact: "info" });
    }
  }
  if (q.kind === "illustrative") reasons.push({ code: "illustrative_data", impact: "info" });
  else if (q.kind === "demo") reasons.push({ code: "demo_data", impact: "info" });
  for (const k of q.unknownCosts) {
    score -= 1;
    reasons.push({ code: "cost_unknown", params: { cost: k }, impact: "down" });
  }
  if (ctx.lot.gradeStatus === "unknown") {
    score -= 1;
    reasons.push({ code: "grade_unknown", impact: "down" });
  } else {
    reasons.push({ code: ctx.lot.gradeStatus === "verified" ? "grade_verified" : "grade_declared", impact: "info" });
  }
  if (q.forecastMonths !== undefined) {
    score = Math.min(score, 2);
    reasons.push({ code: "forecast_reference", impact: "down" });
    if (q.forecastMonths > 2) {
      score = Math.min(score, 1);
      reasons.push({ code: "forecast_long", params: { months: Math.round(q.forecastMonths * 10) / 10 }, impact: "down" });
    }
  }
  if (q.reliability) {
    if (q.reliability === "Low") {
      score -= 1;
      reasons.push({ code: "buyer_low_reliability", impact: "down" });
    } else {
      reasons.push({ code: "buyer_reliability", params: { level: q.reliability }, impact: "info" });
    }
  }
  if (q.postingAgeDays !== undefined && q.postingAgeDays >= 3) {
    score -= 1;
    reasons.push({ code: "posting_aging", params: { days: q.postingAgeDays }, impact: "down" });
  }
  if (q.simulated === "buyer") reasons.push({ code: "simulated_buyer", impact: "info" });
  if (q.simulated === "fpo") reasons.push({ code: "simulated_fpo", impact: "info" });
  const quality: QualityLevel = score >= 3 ? "High" : score === 2 ? "Medium" : "Low";
  return { quality, reasons };
}

function finalize(
  ctx: Ctx,
  base: Omit<RecommendationOption, "net" | "quality" | "qualityReasons" | "flags">,
  price: { low: number; expected: number; high: number } | null,
  costs: CostLine[],
  quality: QualityInput,
): RecommendationOption {
  const lines = applyOverrides(base.id, costs, ctx.lot);
  const net = price ? computeNet(ctx.lot.quantityQtl, price, lines) : null;
  const q = assessQuality(ctx, { ...quality, unknownCosts: net ? net.unknownCostKeys : [] });
  const flags: QualityReason[] = [];
  const reserve = ctx.lot.reservePricePerQtl;
  if (net && reserve && net.price.expected < reserve) {
    flags.push({ code: "below_reserve", params: { reserve, price: net.price.expected }, impact: "down" });
  }
  if (net?.isUpperBound) flags.push({ code: "upper_bound", impact: "down" });
  return {
    ...base,
    eligible: base.eligible && net !== null,
    net,
    quality: q.quality,
    qualityReasons: q.reasons,
    flags,
  };
}

// ---- option builders --------------------------------------------------------

function buildMarketOption(ctx: Ctx, market: Market): RecommendationOption {
  const id = `market:${market.id}`;
  const km = roadKm(ctx.origin, market, ctx.settings.roadFactor);
  const travelDays = km > ctx.settings.sameDayMaxKm ? 1 : 0;
  const sellAfterDays = ctx.baseDelayDays + travelDays;
  const feed = ctx.feeds.get(market.id) ?? null;
  const illus = ctx.scenario?.illustrative?.[market.id];

  const ineligible: QualityReason[] = [];
  if (km > ctx.lot.radiusKm) ineligible.push({ code: "outside_radius", params: { km: Math.round(km), radius: ctx.lot.radiusKm }, impact: "down" });
  const shelf = shelfLifeReason(ctx, sellAfterDays);
  if (shelf) ineligible.push(shelf);

  if (illus) {
    const price = rangeAround(illus.price, BASE_RANGE_PCT);
    const costs = illus.costs.map((c) =>
      line(c.key, c.key === "transport" ? "transport" : c.key === "otherCharges" ? "other" : "market", c.perQtl, "illustrative", c.detail),
    );
    return finalize(
      ctx,
      {
        id,
        kind: "move",
        title: market.name,
        marketId: market.id,
        distanceKm: km,
        sellAfterDays,
        priceBasis: `Illustrative quoted price ${inr(illus.price)}/qtl (PRD worked example — not a market observation)`,
        provenance: [
          {
            sourceId: "illustrative",
            sourceName: "PRD worked example",
            kind: "illustrative",
            observedAt: ctx.now.toISOString(),
            status: "ok",
            note: "Fixed illustrative figures; not live or historical market data.",
          },
        ],
        eligible: ineligible.length === 0,
        ineligibleReasons: ineligible,
      },
      price,
      costs,
      { kind: "illustrative", unknownCosts: [] },
    );
  }

  if (!feed?.latest) ineligible.push({ code: "no_price", params: { market: market.name }, impact: "down" });
  const price = feed?.latest ? rangeAround(feed.latest.modalPrice * ctx.gradeFactor, priceWidthPct(ctx, feed)) : null;
  let costs: CostLine[] = [];
  let vehicleSummary: string | undefined;
  if (price) {
    const tq = cheapestTransport(ctx.lot.quantityQtl, km, ctx.settings.vehicles);
    vehicleSummary = `${tq.trips} × ${tq.vehicle.label.en}`;
    costs = [
      line("transport", "transport", tq.perQtl, "computed", describeTransport(tq)),
      ...marketSideCosts(ctx, chargesFor(ctx, market), price.expected, km, sellAfterDays),
    ];
  }
  return finalize(
    ctx,
    {
      id,
      kind: "move",
      title: market.name,
      marketId: market.id,
      distanceKm: km,
      sellAfterDays,
      priceBasis: feed?.latest
        ? `Modal ${inr(feed.latest.modalPrice)}/qtl on ${feed.latest.date} × grade factor ${ctx.gradeFactor.toFixed(2)}`
        : "No usable price from the feed",
      provenance: feed ? [feed.provenance] : [],
      eligible: ineligible.length === 0,
      ineligibleReasons: ineligible,
      vehicleSummary,
    },
    price,
    costs,
    { feed, kind: "demo", unknownCosts: [] },
  );
}

function buildStoreOption(ctx: Ctx, base: RecommendationOption, days: number): RecommendationOption {
  const c = ctx.commodity;
  const months = days / 30;
  const market = MARKETS.find((m) => m.id === base.marketId)!;
  const feed = ctx.feeds.get(market.id) ?? null;
  const sellAfterDays = ctx.baseDelayDays + days + (base.sellAfterDays - ctx.baseDelayDays);
  const saleDate = addDays(ctx.today, sellAfterDays);
  const idx = SEASONAL_INDEX[c.id];
  const ratio = idx[monthIndex(saleDate)] / idx[monthIndex(ctx.today)];
  const basePrice = base.net!.price;
  const baseWidth = ((basePrice.high - basePrice.expected) / basePrice.expected) * 100;
  const width = baseWidth + MONTHLY_VOLATILITY_PCT[c.id] * Math.sqrt(months);
  const price = rangeAround(basePrice.expected * ratio, width);
  const km = base.distanceKm ?? 0;
  const tq = cheapestTransport(ctx.lot.quantityQtl, km, ctx.settings.vehicles);
  const todayNet = base.net!.netPerQtl.expected;

  const ineligible: QualityReason[] = [];
  const cash = ctx.lot.cashNeededWithinDays;
  if (cash != null && days > cash) ineligible.push({ code: "cash_needed", params: { days: cash }, impact: "down" });

  const costs: CostLine[] = [
    line("transport", "transport", tq.perQtl, "computed", describeTransport(tq)),
    ...marketSideCosts(ctx, chargesFor(ctx, market), price.expected, km, sellAfterDays),
    line("storageRent", "storage", c.storage.rentPerQtlPerMonth * months, "assumption", `${inr(c.storage.rentPerQtlPerMonth)}/qtl/month × ${months.toFixed(1)} months (demo warehouse rate)`),
    line(
      "storageLoss",
      "storage",
      ((c.storage.lossPctPerMonth * months) / 100) * price.expected,
      "assumption",
      `${c.storage.lossPctPerMonth}%/month weight & quality loss × ${months.toFixed(1)} months (demo rate)`,
    ),
    line("storageHandling", "storage", c.storage.handlingPerQtl, "assumption", "Warehouse in/out handling (demo rate)"),
    line(
      "waitingCost",
      "other",
      ((ctx.settings.monthlyInterestPct * months) / 100) * todayNet,
      "assumption",
      `Cost of waiting for money: ${ctx.settings.monthlyInterestPct}%/month × ${months.toFixed(1)} months on today's net ${inr(todayNet)}`,
    ),
  ];

  return finalize(
    ctx,
    {
      id: days === ctx.lot.storageDays ? "store" : `store:${days}`,
      kind: "store",
      title: `Store ${days} days, then sell at ${market.name}`,
      marketId: market.id,
      distanceKm: km,
      sellAfterDays,
      priceBasis: `Seasonal reference: today's ${inr(basePrice.expected)} × demo seasonal index ratio ${ratio.toFixed(3)} (${ctx.today.slice(5, 7)}→${saleDate.slice(5, 7)}); range ±${width.toFixed(1)}%. Not a validated forecast.`,
      provenance: feed ? [feed.provenance] : [],
      eligible: ineligible.length === 0,
      ineligibleReasons: ineligible,
      vehicleSummary: `${tq.trips} × ${tq.vehicle.label.en}`,
    },
    price,
    costs,
    { feed, kind: "demo", unknownCosts: [], forecastMonths: months },
  );
}

function storageUnsuitableOption(ctx: Ctx): RecommendationOption {
  return {
    id: "store",
    kind: "store",
    title: "Store and sell later",
    distanceKm: null,
    sellAfterDays: ctx.baseDelayDays,
    priceBasis: "—",
    net: null,
    provenance: [],
    quality: "Low",
    qualityReasons: [],
    eligible: false,
    ineligibleReasons: [{ code: "storage_unsuitable", params: { shelf: ctx.commodity.shelfLifeDays ?? 0 }, impact: "down" }],
    flags: [],
  };
}

function buildFpoOption(ctx: Ctx, fpo: Fpo): RecommendationOption | null {
  const kmToCentre = roadKm(ctx.origin, fpo, ctx.settings.roadFactor);
  if (kmToCentre > ctx.lot.radiusKm) return null;
  const members = fpo.members[ctx.lot.commodityId] ?? [];
  const pooledQty = ctx.lot.quantityQtl + members.reduce((s, m) => s + m.quantityQtl, 0);
  const id = `fpo:${fpo.id}`;
  // Within the FPO's collection route a flat rate applies; farther away the
  // farmer must bring the lot to the collection point at small-lot rates.
  const collection =
    kmToCentre <= FPO_COLLECTION_RADIUS_KM
      ? line("fpoCollection", "transport", fpo.collectionPerQtl, "assumption", `Farm → ${fpo.locationName} collection point, ${kmToCentre} km (simulated FPO route rate)`)
      : (() => {
          const own = cheapestTransport(ctx.lot.quantityQtl, kmToCentre, ctx.settings.vehicles);
          return line("fpoCollection", "transport", own.perQtl, "computed", `Outside the FPO collection route: you bring the lot to ${fpo.locationName}. ${describeTransport(own)}`);
        })();

  let best: RecommendationOption | null = null;
  for (const market of ctx.markets) {
    const feed = ctx.feeds.get(market.id);
    if (!feed?.latest) continue;
    const km = roadKm(fpo, market, ctx.settings.roadFactor);
    if (km > ctx.lot.radiusKm) continue;
    const travelDays = km > ctx.settings.sameDayMaxKm ? 1 : 0;
    const sellAfterDays = ctx.baseDelayDays + fpo.poolingDelayDays + travelDays;
    const price = rangeAround(feed.latest.modalPrice * ctx.gradeFactor, priceWidthPct(ctx, feed));
    const tq = cheapestTransport(pooledQty, km, ctx.settings.vehicles);
    const ineligible: QualityReason[] = [];
    const shelf = shelfLifeReason(ctx, sellAfterDays);
    if (shelf) ineligible.push(shelf);
    const cash = ctx.lot.cashNeededWithinDays;
    if (cash != null && fpo.poolingDelayDays > cash) ineligible.push({ code: "cash_needed", params: { days: cash }, impact: "down" });

    const costs: CostLine[] = [
      collection,
      line("transport", "transport", tq.perQtl, "computed", `Your share of the pooled ${pooledQty} qtl lot. ${describeTransport(tq)}`),
      ...marketSideCosts(ctx, chargesFor(ctx, market), price.expected, km, sellAfterDays),
      line(
        "waitingCost",
        "other",
        ((ctx.settings.monthlyInterestPct * (fpo.poolingDelayDays / 30)) / 100) * price.expected,
        "assumption",
        `${fpo.poolingDelayDays} day(s) waiting for the pool at ${ctx.settings.monthlyInterestPct}%/month`,
      ),
      line("fpoFee", "other", fpo.serviceFeePerQtl, "assumption", "FPO service fee (simulated FPO rate)"),
    ];
    const opt = finalize(
      ctx,
      {
        id,
        kind: "fpo",
        title: `Pool with ${fpo.name} → ${market.name}`,
        marketId: market.id,
        fpoId: fpo.id,
        distanceKm: kmToCentre,
        sellAfterDays,
        priceBasis: `Modal ${inr(feed.latest.modalPrice)}/qtl at ${market.name} on ${feed.latest.date} × grade factor ${ctx.gradeFactor.toFixed(2)}; pooled lot ${pooledQty} qtl`,
        provenance: [feed.provenance, fpo.provenance],
        eligible: ineligible.length === 0,
        ineligibleReasons: ineligible,
        vehicleSummary: `${tq.trips} × ${tq.vehicle.label.en} (pooled)`,
      },
      price,
      costs,
      { feed, kind: "demo", unknownCosts: [], simulated: "fpo" },
    );
    if (!best || (opt.net && best.net && opt.net.netPerQtl.expected > best.net.netPerQtl.expected)) best = opt;
  }
  return best;
}

function buildBuyerOption(ctx: Ctx, d: BuyerDemand): RecommendationOption {
  const id = `buyer:${d.id}`;
  const km = roadKm(ctx.origin, d, ctx.settings.roadFactor);
  const delivered = d.terms === "delivered";
  const travelDays = delivered && km > ctx.settings.sameDayMaxKm ? 1 : 0;
  const sellAfterDays = ctx.baseDelayDays + travelDays;
  const lot = ctx.lot;

  const ineligible: QualityReason[] = [];
  if (lot.gradeStatus !== "unknown" && !d.acceptedGradeIds.includes(lot.gradeId)) {
    ineligible.push({ code: "grade_not_accepted", params: { grades: d.acceptedGradeIds.join(", ") }, impact: "down" });
  }
  if (lot.quantityQtl < d.minQtl) ineligible.push({ code: "below_buyer_min", params: { min: d.minQtl }, impact: "down" });
  if (lot.quantityQtl > d.maxQtl) ineligible.push({ code: "above_buyer_max", params: { max: d.maxQtl }, impact: "down" });
  if (d.requiredBy < ctx.saleBase) ineligible.push({ code: "buyer_date_passed", params: { date: d.requiredBy }, impact: "down" });
  if (km > lot.radiusKm) ineligible.push({ code: "outside_radius", params: { km: Math.round(km), radius: lot.radiusKm }, impact: "down" });
  if (lot.cashNeededWithinDays != null && d.paymentDays > lot.cashNeededWithinDays) {
    ineligible.push({ code: "payment_too_slow", params: { days: d.paymentDays }, impact: "down" });
  }
  const shelf = shelfLifeReason(ctx, sellAfterDays);
  if (shelf) ineligible.push(shelf);

  const price = { low: d.pricePerQtl, expected: d.pricePerQtl, high: d.pricePerQtl };
  const tq = delivered ? cheapestTransport(lot.quantityQtl, km, ctx.settings.vehicles) : null;
  const riskPct = PAYMENT_RISK_PCT[d.reliability];
  const costs: CostLine[] = [
    tq
      ? line("transport", "transport", tq.perQtl, "computed", describeTransport(tq))
      : line("transport", "transport", 0, "assumption", "Buyer collects at the farm gate (per simulated posting)"),
    line("farmLoading", "handling", ctx.settings.farmLoadingPerQtl, "assumption", "Loading at farm (demo labour rate)"),
    line("packaging", "handling", ctx.commodity.packagingPerQtl, "assumption", `${ctx.commodity.packagingLabel.en} (demo rate)`),
    ...(delivered ? [line("hamali", "market", BUYER_UNLOADING_PER_QTL, "assumption", "Unloading at buyer premises (demo rate)")] : []),
    ...perishableLosses(ctx, d.pricePerQtl, delivered ? km : 0, sellAfterDays),
    line(
      "paymentRisk",
      "other",
      (riskPct / 100) * d.pricePerQtl,
      "assumption",
      `${riskPct}% allowance for ${d.reliability.toLowerCase()} payment reliability (demo assumption)`,
    ),
    line(
      "waitingCost",
      "other",
      ((ctx.settings.monthlyInterestPct * (d.paymentDays / 30)) / 100) * d.pricePerQtl,
      "assumption",
      `Payment after ${d.paymentDays} days at ${ctx.settings.monthlyInterestPct}%/month cost of waiting`,
    ),
  ];
  const postingAgeDays = Math.floor((ctx.now.getTime() - Date.parse(d.postedAt)) / 86400000);
  return finalize(
    ctx,
    {
      id,
      kind: "direct_buyer",
      title: d.buyerName,
      buyerId: d.id,
      distanceKm: km,
      sellAfterDays,
      priceBasis: `Posted offer ${inr(d.pricePerQtl)}/qtl, ${delivered ? `delivered to ${d.locationName}` : "collected at farm gate"}, payment in ${d.paymentDays} days`,
      provenance: [d.provenance],
      eligible: ineligible.length === 0,
      ineligibleReasons: ineligible,
      vehicleSummary: tq ? `${tq.trips} × ${tq.vehicle.label.en}` : "Buyer pickup",
    },
    price,
    costs,
    { kind: "demo", unknownCosts: [], reliability: d.reliability, simulated: "buyer", postingAgeDays },
  );
}

// ---- ranking & explanation --------------------------------------------------

const QUALITY_ORDER: Record<QualityLevel, number> = { High: 3, Medium: 2, Low: 1 };

/**
 * Ranking score = expected net − w × extra downside.
 * Everyday price variation (BASE_RANGE_PCT) affects every market alike, so only
 * the downside BEYOND it — from stale data, unknown grade or a storage
 * forecast — is penalised, weighted by the farmer's risk preference.
 */
export function extraDownside(o: RecommendationOption): number {
  const n = o.net!.netPerQtl;
  const everyday = (o.net!.price.expected * BASE_RANGE_PCT) / 100;
  return Math.max(0, n.expected - n.low - everyday);
}

export function rankingScore(o: RecommendationOption, riskWeight: number): number {
  return o.net!.netPerQtl.expected - riskWeight * extraDownside(o);
}

function groupCost(o: RecommendationOption, group: CostLine["group"]) {
  return o.net!.costs.filter((c) => c.group === group).reduce((s, c) => s + (c.perQtl ?? 0), 0);
}

function proportionalShare(o: RecommendationOption) {
  const p = o.net!.price.expected;
  const prop = o.net!.costs.filter((c) => PRICE_PROPORTIONAL.includes(c.key)).reduce((s, c) => s + (c.perQtl ?? 0), 0);
  return p > 0 ? prop / p : 0;
}

export function recommend(input: EngineInput): Recommendation {
  const ctx = buildCtx(input);
  const { lot, commodity, scenario } = ctx;
  const riskWeight = RISK_WEIGHT[lot.riskPreference];

  const marketOptions = ctx.markets.map((m) => buildMarketOption(ctx, m));
  // The nearest market with a usable price is the "sell nearby" option.
  const nearest = [...marketOptions]
    .filter((o) => o.net && o.distanceKm !== null && o.eligible)
    .sort((a, b) => a.distanceKm! - b.distanceKm!)[0];
  if (nearest && !scenario?.illustrative) nearest.kind = "sell_nearby";

  const bestMarket = marketOptions
    .filter((o) => o.eligible && o.net)
    .sort((a, b) => b.net!.netPerQtl.expected - a.net!.netPerQtl.expected)[0];

  const all: RecommendationOption[] = [...marketOptions];
  let storageCurve: StoragePoint[] | null = null;
  if (scenario?.includeStore !== false) {
    if (!commodity.storage.suitable) {
      all.push(storageUnsuitableOption(ctx));
    } else if (bestMarket && lot.storageDays > 0) {
      all.push(buildStoreOption(ctx, bestMarket, lot.storageDays));
    }
    if (commodity.storage.suitable && bestMarket) {
      storageCurve = STORAGE_HORIZONS.map((days) => {
        const o = days === 0 ? bestMarket : buildStoreOption(ctx, bestMarket, days);
        return { days, net: o.net!.netPerQtl, quality: o.quality, marketName: MARKETS.find((m) => m.id === bestMarket.marketId)!.name };
      });
    }
  }
  if (scenario?.includeFpo !== false) {
    for (const fpo of input.fpos.filter((f) => f.commodities.includes(lot.commodityId))) {
      const o = buildFpoOption(ctx, fpo);
      if (o) all.push(o);
    }
  }
  const directAllowed = ctx.settings.directBuyerAllowed && scenario?.includeDirect !== false;
  if (directAllowed) {
    for (const d of input.buyerDemands.filter((b) => b.commodityId === lot.commodityId)) all.push(buildBuyerOption(ctx, d));
  }

  const eligible = all
    .filter((o) => o.eligible && o.net)
    .sort((a, b) => rankingScore(b, riskWeight) - rankingScore(a, riskWeight) || QUALITY_ORDER[b.quality] - QUALITY_ORDER[a.quality]);
  eligible.forEach((o, i) => (o.rank = i + 1));
  const ineligible = all.filter((o) => !eligible.includes(o));

  const best = eligible[0] ?? null;
  const runner = eligible[1] ?? null;

  // ---- status -------------------------------------------------------------
  let status: RecommendationStatus = "confident";
  if (!best || eligible.every((o) => o.quality === "Low")) status = "insufficient";
  else if (best.quality === "Low" || best.kind === "store") status = "tentative";
  else if (runner && best.net!.netPerQtl.expected - runner.net!.netPerQtl.expected < 0.01 * best.net!.netPerQtl.expected) {
    status = "tentative";
  }

  const why: ExplanationItem[] = [];
  const whatCouldChange: ExplanationItem[] = [];
  const assumptions: ExplanationItem[] = [];
  const missing: ExplanationItem[] = [];
  const qty = lot.quantityQtl;

  if (best) {
    const bn = best.net!;
    why.push({ code: "best_net", params: { title: best.title, net: bn.netPerQtl.expected, total: bn.netTotal.expected, qty } });
    if (runner) {
      const d = bn.netPerQtl.expected - runner.net!.netPerQtl.expected;
      why.push({ code: "beats_runner_up", params: { runnerUp: runner.title, perQtl: d, total: d * qty } });
    }
    const highestQuote = [...eligible].sort((a, b) => b.net!.price.expected - a.net!.price.expected)[0];
    if (highestQuote && highestQuote.id !== best.id && highestQuote.net!.price.expected > bn.price.expected) {
      const hq = highestQuote.net!;
      why.push({
        code: "lower_quote_higher_net",
        params: {
          best: best.title,
          bestQuote: bn.price.expected,
          other: highestQuote.title,
          otherQuote: hq.price.expected,
          quoteDiff: hq.price.expected - bn.price.expected,
          netDiff: bn.netPerQtl.expected - hq.netPerQtl.expected,
        },
      });
    }
    const vs = highestQuote && highestQuote.id !== best.id ? highestQuote : runner;
    if (vs) {
      const groups: CostLine["group"][] = ["transport", "quality", "market", "storage", "other", "handling"];
      const diffs = groups.map((g) => ({ g, d: groupCost(vs, g) - groupCost(best, g) })).sort((a, b) => b.d - a.d);
      if (diffs[0].d > 0) why.push({ code: "cost_advantage", params: { group: diffs[0].g, perQtl: diffs[0].d, vs: vs.title } });
    }
    const topExpected = [...eligible].sort((a, b) => b.net!.netPerQtl.expected - a.net!.netPerQtl.expected)[0];
    if (topExpected.id !== best.id) {
      const te = topExpected.net!.netPerQtl;
      why.push({
        code: "risk_adjusted",
        params: {
          top: topExpected.title,
          gain: te.expected - bn.netPerQtl.expected,
          downside: Math.round(extraDownside(topExpected)),
          preference: lot.riskPreference,
        },
      });
    }
    if (commodity.shelfLifeDays != null) {
      why.push({ code: "shelf_life", params: { remaining: remainingShelfLife(ctx) ?? 0, shelf: commodity.shelfLifeDays } });
    }
    if (best.kind === "fpo") {
      const individual = eligible.find((o) => o.marketId === best.marketId && o.kind !== "fpo" && o.kind !== "store");
      if (individual) {
        why.push({
          code: "fpo_pooling",
          params: {
            transportAlone: groupCost(individual, "transport"),
            transportPooled: groupCost(best, "transport"),
            deltaGain: bn.netPerQtl.expected - individual.net!.netPerQtl.expected,
          },
        });
      }
    }
    if (best.kind === "store" && bestMarket) {
      why.push({
        code: "storage_gain",
        params: {
          days: lot.storageDays,
          deltaGain: bn.netPerQtl.expected - bestMarket.net!.netPerQtl.expected,
          deltaLow: bn.netPerQtl.low - bestMarket.net!.netPerQtl.expected,
        },
      });
    }

    // What could change the result
    if (runner) {
      const margin = bn.netPerQtl.expected - runner.net!.netPerQtl.expected;
      whatCouldChange.push({ code: "runner_up_price_rise", params: { runnerUp: runner.title, amount: Math.ceil(margin / (1 - proportionalShare(runner))) } });
      whatCouldChange.push({ code: "best_price_fall", params: { best: best.title, amount: Math.ceil(margin / (1 - proportionalShare(best))) } });
      if (groupCost(best, "transport") > 0) whatCouldChange.push({ code: "transport_rise", params: { best: best.title, amount: Math.ceil(margin) } });
    }
    const storeOpt = eligible.find((o) => o.kind === "store");
    if (storeOpt && bestMarket && storeOpt.id !== best.id) {
      whatCouldChange.push({
        code: "storage_option",
        params: {
          days: lot.storageDays,
          deltaGain: storeOpt.net!.netPerQtl.expected - bestMarket.net!.netPerQtl.expected,
          deltaLow: storeOpt.net!.netPerQtl.low - bestMarket.net!.netPerQtl.expected,
        },
      });
    }
    if (lot.gradeStatus !== "verified") whatCouldChange.push({ code: "grade_verify", params: {} });
    if (best.flags.some((f) => f.code === "below_reserve")) {
      whatCouldChange.push({ code: "reserve_not_met", params: { reserve: lot.reservePricePerQtl ?? 0 } });
    }
  }

  // Assumptions
  if (scenario?.illustrative) assumptions.push({ code: "illustrative_prices", params: {} });
  else assumptions.push({ code: "demo_prices", params: {} });
  assumptions.push({ code: "road_factor", params: { factor: ctx.settings.roadFactor } });
  assumptions.push({ code: "vehicle_rates", params: {} });
  assumptions.push({ code: "same_day_payment", params: {} });
  assumptions.push({ code: "charges_assumed", params: {} });
  if (commodity.cropClass === "perishable") {
    assumptions.push({ code: "perishable_rates", params: { spoil: commodity.spoilagePctPerDay, transit: commodity.transitLossPctPer100Km } });
  }
  if (all.some((o) => o.kind === "store" && o.net)) assumptions.push({ code: "seasonal_reference", params: {} });
  assumptions.push({ code: "risk_weight", params: { preference: lot.riskPreference, weight: riskWeight } });
  if (!directAllowed && scenario?.includeDirect !== false) assumptions.push({ code: "direct_disabled", params: {} });

  // Missing / degraded data
  let staleOrMissing = 0;
  for (const m of ctx.markets) {
    const f = ctx.feeds.get(m.id);
    if (scenario?.illustrative?.[m.id]) continue;
    if (!f || !f.latest) {
      staleOrMissing++;
      missing.push({ code: "feed_unavailable", params: { market: m.name } });
    } else if (isStale(f)) {
      staleOrMissing++;
      missing.push({ code: "feed_stale", params: { market: m.name, days: f.ageDays ?? 0 } });
    }
  }
  for (const o of all) {
    if (!o.net) continue;
    for (const k of o.net.unknownCostKeys) missing.push({ code: "cost_unknown", params: { option: o.title, cost: k } });
  }
  if (lot.gradeStatus === "unknown") missing.push({ code: "grade_unknown", params: {} });
  const outside = marketOptions.filter((o) => o.ineligibleReasons.some((r) => r.code === "outside_radius")).length;
  if (outside > 0) missing.push({ code: "outside_radius", params: { count: outside, radius: lot.radiusKm } });
  if (eligible.length === 0) missing.push({ code: "no_eligible", params: {} });

  const withNet = all.filter((o) => o.net);
  return {
    lotId: lot.id,
    generatedAt: input.now.toISOString(),
    status,
    bestOptionId: best?.id ?? null,
    runnerUpOptionId: runner?.id ?? null,
    options: eligible,
    ineligible,
    why,
    whatCouldChange,
    assumptions,
    missing,
    diffVsRunnerUp:
      best && runner
        ? {
            perQtl: best.net!.netPerQtl.expected - runner.net!.netPerQtl.expected,
            total: (best.net!.netPerQtl.expected - runner.net!.netPerQtl.expected) * qty,
          }
        : null,
    remainingShelfLifeDays: remainingShelfLife(ctx),
    storageCurve,
    riskWeight,
    stats: {
      optionsCompared: withNet.length,
      optionsWithCompleteCosts: withNet.filter((o) => !o.net!.isUpperBound).length,
      optionsWithProvenance: withNet.filter((o) => o.provenance.length > 0).length,
      staleOrMissingFeeds: staleOrMissing,
      feedsConsidered: ctx.markets.filter((m) => !scenario?.illustrative?.[m.id]).length,
    },
  };
}

function remainingShelfLife(ctx: Ctx): number | null {
  const shelf = ctx.commodity.shelfLifeDays;
  if (shelf == null) return null;
  return shelf - daysBetween(ctx.lot.harvestDate, ctx.saleBase);
}
