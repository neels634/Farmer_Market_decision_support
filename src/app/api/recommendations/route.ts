import { recommendRequestSchema } from "@/lib/schemas";
import { recommend } from "@/lib/engine/recommend";
import { seedBuyerDemands, seedFpos } from "@/lib/data/actors";
import type { ProduceLot } from "@/lib/domain/types";

// Server-side validation + recommendation. Uses only local demo adapters, so it
// works without any external API or internet connection.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be JSON" }, { status: 400 });
  }
  const parsed = recommendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
      { status: 400 },
    );
  }
  const now = new Date();
  try {
    const { lot, settings, userBuyerDemands } = parsed.data;
    const recommendation = recommend({
      lot: lot as ProduceLot,
      settings,
      now,
      buyerDemands: [...seedBuyerDemands(now), ...userBuyerDemands],
      fpos: seedFpos(now),
    });
    return Response.json({ recommendation });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Could not compute recommendation" }, { status: 422 });
  }
}
