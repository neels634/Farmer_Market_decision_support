import type { CostKey, FeedSetting, Localized, MarketCharges, ProduceLot } from "@/lib/domain/types";
import { addDays, dateOnly } from "@/lib/domain/dates";

export type ScenarioId = "A" | "B" | "C" | "D" | "E";

export interface IllustrativeMarket {
  price: number;
  costs: { key: CostKey; perQtl: number; detail: string }[];
}

export interface ScenarioConfig {
  id: ScenarioId;
  title: Localized;
  summary: Localized;
  /** Restrict to these markets (default: all markets trading the crop). */
  marketIds?: string[];
  includeStore?: boolean;
  includeFpo?: boolean;
  includeDirect?: boolean;
  /** Fixed figures from the PRD worked example. Replace computed prices and costs. */
  illustrative?: Record<string, IllustrativeMarket>;
  feedOverrides?: Record<string, FeedSetting>;
  chargeOverrides?: Record<string, Partial<MarketCharges>>;
  buildLot(now: Date): Omit<ProduceLot, "id" | "createdAt">;
}

export const SCENARIOS: ScenarioConfig[] = [
  {
    id: "A",
    title: { en: "Lower quote, better net", hi: "कम भाव, ज़्यादा शुद्ध आय", mr: "कमी भाव, जास्त निव्वळ उत्पन्न" },
    summary: {
      en: "40 qtl soybean: Nagpur quotes more, but Wardha leaves more money after costs. Illustrative figures.",
      hi: "40 क्विं. सोयाबीन: नागपुर का भाव ज़्यादा, पर खर्च के बाद वर्धा में ज़्यादा पैसा। उदाहरणात्मक आंकड़े।",
      mr: "40 क्विं. सोयाबीन: नागपूरचा भाव जास्त, पण खर्चानंतर वर्ध्यात जास्त पैसे. उदाहरणादाखल आकडे.",
    },
    marketIds: ["nagpur", "wardha"],
    includeStore: false,
    includeFpo: false,
    includeDirect: false,
    illustrative: {
      nagpur: {
        price: 4720,
        costs: [
          { key: "transport", perQtl: 310, detail: "Illustrative freight, farm → Nagpur" },
          { key: "hamali", perQtl: 30, detail: "Illustrative loading/unloading" },
          { key: "weighing", perQtl: 10, detail: "Illustrative weighing" },
          { key: "otherCharges", perQtl: 40, detail: "Illustrative market and other charges" },
        ],
      },
      wardha: {
        price: 4610,
        costs: [
          { key: "transport", perQtl: 90, detail: "Illustrative freight, farm → Wardha" },
          { key: "hamali", perQtl: 25, detail: "Illustrative loading/unloading" },
          { key: "weighing", perQtl: 10, detail: "Illustrative weighing" },
          { key: "otherCharges", perQtl: 35, detail: "Illustrative market and other charges" },
        ],
      },
    },
    buildLot: (now) => {
      const today = dateOnly(now);
      return {
        commodityId: "soybean",
        variety: "JS 9560",
        quantityQtl: 40,
        gradeId: "FAQ",
        gradeStatus: "verified",
        locationId: "seloo",
        harvestDate: addDays(today, -6),
        availableFrom: today,
        radiusKm: 120,
        storageDays: 60,
        riskPreference: "balanced",
        scenarioId: "A",
      };
    },
  },
  {
    id: "B",
    title: { en: "Perishable orange lot", hi: "जल्दी खराब होने वाला संतरा", mr: "नाशवंत संत्रा लॉट" },
    summary: {
      en: "60 qtl oranges near Katol: Amravati quotes highest, but distance, transit loss and an extra day cost more.",
      hi: "कटोल के पास 60 क्विं. संतरा: अमरावती का भाव सबसे ऊँचा, पर दूरी और देरी की कीमत ज़्यादा।",
      mr: "काटोलजवळ 60 क्विं. संत्री: अमरावतीचा भाव सर्वाधिक, पण अंतर व उशिराचा खर्च जास्त.",
    },
    buildLot: (now) => {
      const today = dateOnly(now);
      return {
        commodityId: "orange",
        variety: "Nagpur Mandarin (Ambia)",
        quantityQtl: 60,
        gradeId: "B",
        gradeStatus: "declared",
        locationId: "katol-area",
        harvestDate: today,
        availableFrom: today,
        radiusKm: 150,
        storageDays: 0,
        riskPreference: "balanced",
        scenarioId: "B",
      };
    },
  },
  {
    id: "C",
    title: { en: "Sell now or store?", hi: "अभी बेचें या भंडारण करें?", mr: "आत्ता विकायचे की साठवायचे?" },
    summary: {
      en: "80 qtl soybean near Hinganghat: compare selling today with storing 30–120 days. Uncertainty is shown, not hidden.",
      hi: "हिंगणघाट के पास 80 क्विं. सोयाबीन: आज बेचने की तुलना 30–120 दिन भंडारण से।",
      mr: "हिंगणघाटजवळ 80 क्विं. सोयाबीन: आज विकणे विरुद्ध 30–120 दिवस साठवण.",
    },
    buildLot: (now) => {
      const today = dateOnly(now);
      return {
        commodityId: "soybean",
        variety: "JS 335",
        quantityQtl: 80,
        gradeId: "FAQ",
        gradeStatus: "verified",
        locationId: "hinganghat-area",
        harvestDate: addDays(today, -5),
        availableFrom: today,
        radiusKm: 100,
        storageDays: 60,
        riskPreference: "balanced",
        scenarioId: "C",
      };
    },
  },
  {
    id: "D",
    title: { en: "Small farmer + FPO", hi: "छोटा किसान + FPO", mr: "लहान शेतकरी + FPO" },
    summary: {
      en: "8 qtl tur near Umred: shipping alone wastes most of a vehicle. Pooling with an FPO spreads the freight.",
      hi: "उमरेड के पास 8 क्विं. तुअर: अकेले भेजने पर गाड़ी का खर्च ज़्यादा। FPO के साथ भेजने से बँटता है।",
      mr: "उमरेडजवळ 8 क्विं. तूर: एकट्याने पाठवल्यास वाहनखर्च जास्त. FPO सोबत खर्च विभागला जातो.",
    },
    buildLot: (now) => {
      const today = dateOnly(now);
      return {
        commodityId: "tur",
        variety: "BSMR 736",
        quantityQtl: 8,
        gradeId: "FAQ",
        gradeStatus: "declared",
        locationId: "umred-area",
        harvestDate: addDays(today, -10),
        availableFrom: today,
        radiusKm: 80,
        storageDays: 60,
        riskPreference: "balanced",
        scenarioId: "D",
      };
    },
  },
  {
    id: "E",
    title: { en: "Missing & stale data", hi: "अधूरा व पुराना डेटा", mr: "अपूर्ण व जुना डेटा" },
    summary: {
      en: "40 qtl soybean near Kalmeshwar while feeds are stale or down. The app says what's missing instead of guessing.",
      hi: "कलमेश्वर के पास 40 क्विं. सोयाबीन, जब डेटा पुराना या बंद है। ऐप अनुमान नहीं लगाता, कमी बताता है।",
      mr: "कळमेश्वरजवळ 40 क्विं. सोयाबीन, डेटा जुना किंवा बंद असताना. अ‍ॅप अंदाज न लावता काय कमी आहे ते सांगते.",
    },
    feedOverrides: {
      kalmeshwar: { status: "stale", ageDays: 9 },
      katol: { status: "stale", ageDays: 11 },
      nagpur: { status: "unavailable", ageDays: 0 },
      saoner: { status: "ok", ageDays: 4 },
    },
    chargeOverrides: { saoner: { hamaliPerQtl: null } },
    buildLot: (now) => {
      const today = dateOnly(now);
      return {
        commodityId: "soybean",
        variety: "Other",
        quantityQtl: 40,
        gradeId: "FAQ",
        gradeStatus: "unknown",
        locationId: "kalmeshwar-area",
        harvestDate: addDays(today, -3),
        availableFrom: today,
        radiusKm: 55,
        storageDays: 60,
        riskPreference: "balanced",
        scenarioId: "E",
      };
    },
  },
];

export const SCENARIO_BY_ID: Record<string, ScenarioConfig> = Object.fromEntries(SCENARIOS.map((s) => [s.id, s]));

export function scenarioLotId(id: ScenarioId) {
  return `scenario-${id}`;
}

export function buildScenarioLot(id: ScenarioId, now: Date): ProduceLot {
  const s = SCENARIO_BY_ID[id];
  return { ...s.buildLot(now), id: scenarioLotId(id), createdAt: now.toISOString() };
}
