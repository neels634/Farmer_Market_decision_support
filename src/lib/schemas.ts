import { z } from "zod";
import { COMMODITIES } from "@/lib/data/commodities";
import { LOCATION_BY_ID, MARKET_BY_ID } from "@/lib/data/markets";

// Schemas are shared by the client form and the server route handler so the
// same rules are enforced on both sides.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const safeText = (max: number) =>
  z
    .string()
    .max(max)
    .transform((s) => s.replace(/[<>]/g, "").trim());

const costKey = z.enum([
  "transport",
  "farmLoading",
  "packaging",
  "hamali",
  "weighing",
  "marketFee",
  "commission",
  "transitLoss",
  "spoilage",
  "storageRent",
  "storageLoss",
  "storageHandling",
  "waitingCost",
  "fpoCollection",
  "fpoFee",
  "paymentRisk",
  "otherCharges",
]);

export const lotSchema = z
  .object({
    id: z.string().min(1).max(64),
    createdAt: z.string().max(40),
    commodityId: z.enum(["orange", "soybean", "tur"]),
    variety: safeText(60),
    quantityQtl: z.number().positive("Quantity must be more than 0").max(5000, "Quantity looks too large for one lot (max 5,000 qtl)"),
    gradeId: z.string().max(10),
    gradeStatus: z.enum(["verified", "declared", "unknown"]),
    locationId: z.string().max(40).nullable(),
    customLocation: z
      .object({ lat: z.number().min(19).max(23), lng: z.number().min(76).max(81), label: safeText(60) })
      .nullable()
      .optional(),
    harvestDate: isoDate,
    availableFrom: isoDate,
    radiusKm: z.number().min(5).max(400),
    storageDays: z.number().int().min(0).max(180),
    reservePricePerQtl: z.number().min(0).max(100000).nullable().optional(),
    cashNeededWithinDays: z.number().int().min(0).max(365).nullable().optional(),
    riskPreference: z.enum(["cautious", "balanced", "patient"]),
    notes: safeText(500).optional(),
    scenarioId: z.enum(["A", "B", "C", "D", "E"]).nullable().optional(),
    ignoreScenarioGaps: z.boolean().optional(),
    costOverrides: z
      .record(z.string().max(80), z.partialRecord(costKey, z.number().min(0).max(100000).nullable()))
      .optional(),
  })
  .superRefine((lot, ctx) => {
    const c = COMMODITIES[lot.commodityId];
    if (!c.grades.some((g) => g.id === lot.gradeId)) {
      ctx.addIssue({ code: "custom", path: ["gradeId"], message: "Grade does not match the crop" });
    }
    if (!lot.customLocation && !(lot.locationId && LOCATION_BY_ID[lot.locationId])) {
      ctx.addIssue({ code: "custom", path: ["locationId"], message: "Choose a location" });
    }
    if (lot.availableFrom < lot.harvestDate) {
      ctx.addIssue({ code: "custom", path: ["availableFrom"], message: "Available date cannot be before harvest" });
    }
  });

const vehicleSchema = z.object({
  id: z.enum(["tempo", "pickup", "truck"]),
  label: z.object({ en: z.string().max(40), hi: z.string().max(40), mr: z.string().max(40) }),
  capacityQtl: z.number().positive().max(500),
  fixedPerTrip: z.number().min(0).max(100000),
  perKm: z.number().min(0).max(1000),
});

export const settingsSchema = z.object({
  feeds: z.record(
    z.string().refine((id) => !!MARKET_BY_ID[id], "Unknown market"),
    z.object({ status: z.enum(["ok", "stale", "unavailable"]), ageDays: z.number().int().min(0).max(120) }),
  ),
  vehicles: z.array(vehicleSchema).min(1).max(5),
  farmLoadingPerQtl: z.number().min(0).max(1000),
  monthlyInterestPct: z.number().min(0).max(10),
  directBuyerAllowed: z.boolean(),
  roadFactor: z.number().min(1).max(2),
  sameDayMaxKm: z.number().min(10).max(500),
});

const provenanceSchema = z.object({
  sourceId: z.string().max(40),
  sourceName: z.string().max(80),
  kind: z.enum(["live", "historical", "demo", "illustrative"]),
  observedAt: z.string().max(40),
  status: z.enum(["ok", "stale", "unavailable"]),
  note: z.string().max(200).optional(),
});

export const buyerDemandSchema = z.object({
  id: z.string().min(1).max(64),
  buyerName: safeText(80).pipe(z.string().min(2, "Enter a buyer name")),
  buyerType: z.enum(["processor", "trader", "exporter", "retail_chain"]),
  commodityId: z.enum(["orange", "soybean", "tur"]),
  acceptedGradeIds: z.array(z.string().max(10)).min(1, "Pick at least one grade"),
  minQtl: z.number().positive(),
  maxQtl: z.number().positive(),
  pricePerQtl: z.number().positive().max(100000),
  terms: z.enum(["farm_gate", "delivered"]),
  lat: z.number().min(19).max(23),
  lng: z.number().min(76).max(81),
  locationName: safeText(60),
  paymentDays: z.number().int().min(0).max(120),
  reliability: z.enum(["High", "Medium", "Low"]),
  requiredBy: isoDate,
  postedAt: z.string().max(40),
  provenance: provenanceSchema,
  createdInDemo: z.boolean().optional(),
});

export const recommendRequestSchema = z.object({
  lot: lotSchema,
  settings: settingsSchema,
  userBuyerDemands: z.array(buyerDemandSchema).max(50).default([]),
});

export type RecommendRequest = z.input<typeof recommendRequestSchema>;
