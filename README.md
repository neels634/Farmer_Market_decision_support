# NetBhav — farmer market decision support (SIH26132 prototype)

**"Where, when and how should I sell my produce?"**
NetBhav compares a farmer's realistic selling options — nearby mandi, a farther mandi, storing, pooling through an FPO, or a direct buyer — by **expected net realisation after every cost**, and shows the working. It optimises for what the farmer keeps, not the highest quoted price.

> **This is a hackathon prototype for the Nagpur region. All prices, buyers and FPOs are simulated or illustrative. No real trades, payments or external integrations exist.**

## Run it

Requires Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:3000
```

Other commands:

```bash
npm test           # Vitest unit tests (engine, scenarios, validation)
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build && npm start   # production build
```

No environment variables are needed. `.env.example` lists the variables a future live integration would use; none are read today. The app works fully offline: fonts are bundled, the map is drawn locally, and all data comes from a local demo adapter.

## Demo walkthrough (≈5 minutes)

| Scenario | Where | What it shows |
|---|---|---|
| **A — Lower quote, better net** | Home → "Try the Wardha example" | 40 qtl soybean. Nagpur quotes ₹4,720, Wardha ₹4,610 — but after transport and charges Wardha nets ₹4,450 vs ₹4,330/qtl: **₹120/qtl, ₹4,800 for the lot**. Uses the PRD's illustrative figures, labelled as such. |
| **B — Perishable oranges** | My lots → Scenario B | Amravati quotes highest, but ~120 km of transit loss plus a next-day sale costs more. Shelf life is shown; storage is marked unsuitable. |
| **C — Sell now or store?** | Scenario C | Storage curve for 30–120 days with a widening uncertainty band. At 60 days a "balanced" farmer is advised to sell now; switch to 90 days or "Can wait" and storage wins, as a **tentative** recommendation. |
| **D — Small farmer + FPO** | Scenario D, then **FPO pooling** | 8 qtl tur: shipping alone fills 80% of a tempo; pooling cuts freight from ~₹147 to ~₹55/qtl. The dal-mill buyer is set aside (below its 25 qtl minimum). |
| **E — Missing & stale data** | Scenario E | Feeds stale/unavailable, an unknown charge, unknown grade → "Not enough reliable data to recommend confidently", with the gaps listed. Toggle **Simulated data gaps → Off** to see the result with fresh data. |

Also try: **Add a lot** (4-step form with validation and a draft kept for the session), editing any cost line, setting a reserve price, switching **मराठी / हिन्दी / English**, the **Listen** button (browser speech synthesis), and **Data & demo** to mark any market feed stale or unavailable.

## How the recommendation works

All logic is deterministic, rule-based and lives in `src/lib/engine` (pure functions, no UI).

- **Net realisation** (`net.ts`): `net = expected sale price − transport − loading/unloading − market fee − commission − quality loss − storage − other`, per quintal, then × quantity. Each cost key appears once per option (no double counting). **Unknown costs are never zero**: the net is flagged as an upper bound and data quality drops.
- **Options** (`recommend.ts`): every APMC within the farmer's radius, a store-then-sell option for storable crops, FPO pooling (pooled freight via the same vehicle model), and simulated direct buyers (if the demo rule allows). Options are set aside with a reason when beyond the radius, past shelf life, without a usable price, outside a buyer's terms, or paying later than the farmer needs cash.
- **Transport** (`logistics.ts`): road km ≈ straight-line × 1.3; cheapest of tempo / pickup / truck with trips = ⌈qty ÷ capacity⌉. Rates are editable.
- **Price range**: ±2% everyday variation, widened for ageing/stale data and unknown grade; storage uses a demo seasonal index and widens with √months. These are transparent rules, not statistical intervals.
- **Ranking**: expected net minus a risk-preference weight × downside *beyond* everyday variation. With fresh market data this is simply the highest expected net.
- **Data quality**: High / Medium / Low from freshness, completeness, grade certainty and forecast horizon — never a fake percentage. If every option is Low, the app declines to recommend confidently.
- **Explanations**: generated from structured result codes (why, what could change it, assumptions, missing data) and rendered in all three languages.

## Architecture

```
src/
  app/                    Next.js App Router pages + /api/recommendations route handler
  components/             UI (shell, primitives, charts, farmer screens)
  lib/domain/             Types and date helpers
  lib/data/               Seeded demo data: commodities, markets, buyers, FPOs, scenarios,
                          and the data-source registry / demo feed adapter
  lib/engine/             Net calculator, logistics, recommendation, FPO, insights (+ tests)
  lib/schemas.ts          Zod schemas shared by client forms and the server route
  lib/i18n/               English / Hindi / Marathi strings
  lib/store/              Client demo store (localStorage) and recommendation hook
```

- **Next.js 16 + TypeScript + Tailwind CSS 4**, Zod for validation, Lucide icons, Vitest. Charts and the map are hand-built SVG/HTML (no tile server, works offline).
- The browser posts the lot + demo settings to `POST /api/recommendations`; the server re-validates with Zod and runs the engine. Lots, decisions and buyer posts live in the browser's localStorage only — no database and no personal data beyond what the farmer types.
- Data adapters (`lib/data/sources.ts`) are separate from the engine, so a verified source can replace the demo feed without touching ranking logic.

## Data integrity

| Source | Status |
|---|---|
| NetBhav demo market feed | **Simulated.** Deterministic generated prices/arrivals/bidders for 10 real APMC towns. Not real data. |
| PRD worked example | **Illustrative.** Used only in Scenario A, labelled everywhere it appears. |
| Buyers, FPOs, member lots | **Simulated** fictional entities, all named "(simulated)". |
| AGMARKNET, e-NAM, weather | **Not connected.** API access and licensing not verified; nothing is fetched. |

Market names and approximate coordinates are real towns; their prices and charges in the app are demo values. Charges are assumed farmer-borne demo rates — who pays what differs by market and state. The direct-buyer switch is a demo setting, not legal advice.

## Known limitations

- No live data, no authentication, no database; state is per-browser.
- Road distances are estimated, not routed. Vehicle rates, charges, spoilage and storage parameters are demo assumptions (most are editable).
- The storage "forecast" is a seasonal reference pattern, not a validated model. No accuracy is claimed.
- Hindi and Marathi cover all farmer-facing screens; some secondary-screen text (methodology, cost-line working, buyer/FPO detail) is English only. Translations have not been reviewed by native speakers.
- Voice: read-aloud uses the browser's speech synthesis and depends on installed voices; voice input is not implemented. SMS/IVR is not implemented.
- Prototype metrics on the Insights page count this browser's session only; they are not measured farmer impact.
