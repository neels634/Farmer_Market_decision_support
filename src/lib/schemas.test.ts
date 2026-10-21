import { describe, expect, it } from "vitest";
import { recommendRequestSchema } from "@/lib/schemas";
import { buildScenarioLot } from "@/lib/data/scenarios";
import { defaultSettings } from "@/lib/data/markets";

const NOW = new Date("2026-10-21T06:00:00Z");

describe("request validation", () => {
  it("accepts a seeded scenario lot", () => {
    const r = recommendRequestSchema.safeParse({ lot: buildScenarioLot("B", NOW), settings: defaultSettings() });
    expect(r.success).toBe(true);
  });
  it("rejects zero quantity, wrong grade and impossible dates", () => {
    const lot = { ...buildScenarioLot("B", NOW), quantityQtl: 0, gradeId: "FAQ", availableFrom: "2026-01-01" };
    const r = recommendRequestSchema.safeParse({ lot, settings: defaultSettings() });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["lot.quantityQtl", "lot.gradeId", "lot.availableFrom"]));
  });
  it("strips angle brackets from free text", () => {
    const lot = { ...buildScenarioLot("A", NOW), notes: "<script>x</script>" };
    const r = recommendRequestSchema.parse({ lot, settings: defaultSettings() });
    expect(r.lot.notes).not.toMatch(/[<>]/);
  });
});
