import type { BuyerDemand, Fpo, Provenance } from "@/lib/domain/types";
import { addDays, dateOnly } from "@/lib/domain/dates";

// Buyers and FPOs below are FICTIONAL demo entities. Names are invented and
// deliberately labelled "(simulated)" so they cannot be mistaken for real
// organisations.

function demoProvenance(sourceId: string, sourceName: string, observedAt: string): Provenance {
  return { sourceId, sourceName, kind: "demo", observedAt, status: "ok" };
}

export function seedBuyerDemands(now: Date): BuyerDemand[] {
  const today = dateOnly(now);
  const posted = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86400000).toISOString();
  const prov = (daysAgo: number) => demoProvenance("buyer-posts", "Simulated buyer postings", posted(daysAgo));
  return [
    {
      id: "bd-juice",
      buyerName: "Vidarbha Juice Works (simulated)",
      buyerType: "processor",
      commodityId: "orange",
      acceptedGradeIds: ["B", "C"],
      minQtl: 20,
      maxQtl: 300,
      pricePerQtl: 3150,
      terms: "farm_gate",
      lat: 21.24,
      lng: 78.93,
      locationName: "Kalmeshwar MIDC",
      paymentDays: 15,
      reliability: "Medium",
      requiredBy: addDays(today, 10),
      postedAt: posted(1),
      provenance: prov(1),
    },
    {
      id: "bd-retail",
      buyerName: "Fresh-basket retail DC (simulated)",
      buyerType: "retail_chain",
      commodityId: "orange",
      acceptedGradeIds: ["A"],
      minQtl: 30,
      maxQtl: 120,
      pricePerQtl: 3900,
      terms: "delivered",
      lat: 21.1,
      lng: 79.05,
      locationName: "Nagpur (Wadi)",
      paymentDays: 21,
      reliability: "High",
      requiredBy: addDays(today, 6),
      postedAt: posted(2),
      provenance: prov(2),
    },
    {
      id: "bd-oilmill",
      buyerName: "Wardha Oilseed Processors (simulated)",
      buyerType: "processor",
      commodityId: "soybean",
      acceptedGradeIds: ["FAQ"],
      minQtl: 50,
      maxQtl: 2000,
      pricePerQtl: 4500,
      terms: "delivered",
      lat: 20.73,
      lng: 78.62,
      locationName: "Wardha",
      paymentDays: 7,
      reliability: "High",
      requiredBy: addDays(today, 14),
      postedAt: posted(1),
      provenance: prov(1),
    },
    {
      id: "bd-trader",
      buyerName: "Sample Trader, Saoner (simulated)",
      buyerType: "trader",
      commodityId: "soybean",
      acceptedGradeIds: ["FAQ", "BFAQ"],
      minQtl: 10,
      maxQtl: 200,
      pricePerQtl: 4380,
      terms: "farm_gate",
      lat: 21.38,
      lng: 78.92,
      locationName: "Saoner",
      paymentDays: 30,
      reliability: "Low",
      requiredBy: addDays(today, 7),
      postedAt: posted(3),
      provenance: prov(3),
    },
    {
      id: "bd-dalmill",
      buyerName: "Nagpur Dal Mill (simulated)",
      buyerType: "processor",
      commodityId: "tur",
      acceptedGradeIds: ["FAQ"],
      minQtl: 25,
      maxQtl: 500,
      pricePerQtl: 7200,
      terms: "delivered",
      lat: 21.13,
      lng: 79.08,
      locationName: "Nagpur (Hingna Road)",
      paymentDays: 10,
      reliability: "Medium",
      requiredBy: addDays(today, 20),
      postedAt: posted(2),
      provenance: prov(2),
    },
  ];
}

export function seedFpos(now: Date): Fpo[] {
  const prov = demoProvenance("fpo-demo", "Simulated FPO records", new Date(now.getTime() - 86400000).toISOString());
  return [
    {
      id: "fpo-umred",
      name: "Umred Tur Producers' Collective (simulated)",
      locationName: "Umred",
      lat: 20.855,
      lng: 79.32,
      commodities: ["tur", "soybean"],
      serviceFeePerQtl: 25,
      collectionPerQtl: 12,
      poolingDelayDays: 3,
      members: {
        tur: [
          { id: "m1", farmerLabel: "Member farmer 1", quantityQtl: 12, locationName: "Umred area" },
          { id: "m2", farmerLabel: "Member farmer 2", quantityQtl: 9, locationName: "Umred area" },
          { id: "m3", farmerLabel: "Member farmer 3", quantityQtl: 15, locationName: "Bhiwapur road" },
          { id: "m4", farmerLabel: "Member farmer 4", quantityQtl: 6, locationName: "Umred area" },
          { id: "m5", farmerLabel: "Member farmer 5", quantityQtl: 10, locationName: "Kuhi road" },
          { id: "m6", farmerLabel: "Member farmer 6", quantityQtl: 14, locationName: "Umred area" },
        ],
        soybean: [
          { id: "s1", farmerLabel: "Member farmer 1", quantityQtl: 18, locationName: "Umred area" },
          { id: "s2", farmerLabel: "Member farmer 2", quantityQtl: 22, locationName: "Umred area" },
          { id: "s3", farmerLabel: "Member farmer 3", quantityQtl: 11, locationName: "Kuhi road" },
        ],
      },
      provenance: prov,
    },
    {
      id: "fpo-katol",
      name: "Katol Orange Growers' Group (simulated)",
      locationName: "Katol",
      lat: 21.275,
      lng: 78.59,
      commodities: ["orange"],
      serviceFeePerQtl: 40,
      collectionPerQtl: 15,
      poolingDelayDays: 1,
      members: {
        orange: [
          { id: "o1", farmerLabel: "Member farmer 1", quantityQtl: 40, locationName: "Katol area" },
          { id: "o2", farmerLabel: "Member farmer 2", quantityQtl: 35, locationName: "Narkhed road" },
          { id: "o3", farmerLabel: "Member farmer 3", quantityQtl: 25, locationName: "Katol area" },
        ],
      },
      provenance: prov,
    },
    {
      id: "fpo-hinganghat",
      name: "Hinganghat Soy Farmers' Company (simulated)",
      locationName: "Hinganghat",
      lat: 20.555,
      lng: 78.83,
      commodities: ["soybean", "tur"],
      serviceFeePerQtl: 22,
      collectionPerQtl: 10,
      poolingDelayDays: 2,
      members: {
        soybean: [
          { id: "h1", farmerLabel: "Member farmer 1", quantityQtl: 30, locationName: "Hinganghat area" },
          { id: "h2", farmerLabel: "Member farmer 2", quantityQtl: 45, locationName: "Samudrapur road" },
          { id: "h3", farmerLabel: "Member farmer 3", quantityQtl: 25, locationName: "Hinganghat area" },
        ],
        tur: [
          { id: "ht1", farmerLabel: "Member farmer 1", quantityQtl: 14, locationName: "Hinganghat area" },
          { id: "ht2", farmerLabel: "Member farmer 2", quantityQtl: 20, locationName: "Hinganghat area" },
        ],
      },
      provenance: prov,
    },
  ];
}
