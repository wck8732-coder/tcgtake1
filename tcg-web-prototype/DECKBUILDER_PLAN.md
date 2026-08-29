# DECKBUILDER_PLAN — Research-Backed Deck Construction Script (v0.1050)

> Status: PLAN (not yet approved for implementation). Prepared 2026-08-29.
> Problem being solved: `gen_decks.js` currently fills the 46 non-land slots cheapest-first,
> which floods 1-drops and produces weak curves (the reason Crimson sims pre-rebalance were ~10%).
> This plan replaces that fill logic with math proven by MTG Arena / competitive Magic construction.

---

## 1. What MTGA's backend actually does (research findings)

MTG Arena itself has **no AI deckbuilder** — its deck-construction UX is filter/search + format
*validation* (min 60, max 4 copies, ban/legality checks). The "proven formulas" live in:

1. **Frank Karsten — land count regression** (95,000+ winning tournament decks, 2022):
   `lands = 19.59 + 1.90 × avgManavalue − 0.28 × cheapDrawOrRamp [+0.27 companion]`, scaled by
   deck size/60. Derived by least-squares regression. Validates an *average curve*, not the curve.
2. **Frank Karsten — colored-source / on-curve methodology**: a deck "consistently casts" a CMC-n
   card if `P(draw ≥ n lands by turn n on the play) ≥ 89+n%`, after a reasonable mulligan rule.
   Consistency bar rises with CMC (90% for 1-drops → 96% for 7-drops). This is the real backbone for
   curve-slot allocation (how many copies of a 2-drop you need to reliably play it on turn 2).
3. **MTGA BO1 hand smoother (official, Oct 2018)**: draws an opening hand from **two** separately
   randomized copies of the deck and gives the player the hand whose lands:spells ratio is **closest
   to the deck's average** (color ignored). Community reverse-engineering (17lands/draftsim/mtgazone):
   - Actually samples ~3 hands (recent builds) and picks a hand with probability weighted toward the
     most "average" ratio; **mulligans are also smoothed** (contradicting the official note).
   - Average land count *unchanged*; only variance is cut (0/6/7-land hands are ~disappear; 3-land
     hands spike to ~60% for mainstay land counts).
   - **Known cutoff:** decks with **≥22 lands** in 60 majority-favor 3-land hands; ≤21 favor 2-land
     hands. Our fixed 24 lands in 70 (≈ 34.3% → smoothed-peak ~3 lands) sits comfortably in the
     "always 3-ish lands" zone.
4. **Hypergeometric curve-slot math**: 4 copies in a 60-card deck ≈ 39.9% to appear in the opening 7.
   Inverting: to hit a CMC-n play on turn n with ~90% consistency you need roughly 12-14 copies of
   that slot in 60 (fewer as n grows, because later turns draw more cards).

### What this means for OUR game (simplifications)
- **Mono-faction decks** → every land is a colored source of the deck's faction. Karsten's entire
  colored-source table collapses to "did we draw N lands by turn N". Only the land-drop/curve math
  survives.
- **Land count is FIXED at 24** (validated by `validate-data.js` C-checks: 70 total / 24 lands /
  46 non-land). So the Karsten regression cannot choose land count — it instead becomes a **curve
  audit band**: compute the avgManavalue that 24 lands *supports* and shape the 46 non-land curve
  to land inside it (with the fixed-count caveat that we build slightly land-slim ≥ Karsten by design).
- **Both formats are 4-copy only** (no rarity caps since v0.1048) → no rarity budget constraint; the
  only hard caps are 4 copies/card and "exactly 46 non-land / 24 lands / 70 total".

---

## 2. Deployment target

New file `deckbuilder.js` (root, Node, strict module) that **replaces the fill logic inside
`gen_decks.js`** (single source of truth for deck generation). `gen_decks.js` keeps its CLI/output
shape (`formats: { Classic: {decks}, Standard: {decks} }`, slug-mapping compliance, same 12 decks),
but delegates card selection to `deckbuilder.js`'s exported `buildDeck({faction, format})`.

Pipeline: `deckbuilder.js` → `gen_decks.js` → `decks.json` → `validate-data.js` (unchanged C-checks)
→ engine/sim. `verify.ps1` untouched. `build-unity-cards.js` copies the same `decks.json` (step 7).

---

## 3. Algorithm (the math, step by step)

For each of the 6 faction decks, run once per format (Classic + Standard), producing 12 decks.

### Step 0 — Inputs
- Card pool = all non-land cards of the faction (from `card_database.json`, 46-slot target).
- Multiplier tables derived from Karsten, scaled 60 → 70 cards by ×(70/60) on source counts.
- Archetype profile per faction (drives curve targets + role priorities):
  | Faction | Archetype | Curve bias | avgMV target (validated) |
  |---|---|---|---|
  | Crimson | aggro-burn | 1-3 heavy | ~2.3 |
  | Sunforged | ramp-stompy | 3-6 heavy | ~3.2 |
  | Lantern | midrange-death | 2-4 | ~2.9 |
  | Gilded | control-draw | 3-5 | ~3.3 |
  | Zealot | aggro-buff | 1-3 | ~2.5 |
  | Colorless | artifact-midrange | 2-4 | ~3.0 |

### Step 1 — Curved land audit (Karsten regression, fixed-land flavor)
- Compute `avgMV` of the current candidate → expected lands for a 70-card deck:
  `landsExpected = (19.59 + 1.90×avgMV) × (70/60)`.
- Because 24 lands are fixed, define an **acceptance band**: `avgMV ∈ [2.4, 3.4]` roughly (bands per
  archetype in Step 0). If the resulting curve falls outside, the builder biases selection up/down
  the cost ladder (Step 3) until it lands inside and, ideally, within ±0.3 of the archetype target.

### Step 2 — Curve-slot allocation (Karsten on-curve methodology)
- For each CMC `n` (1..6), solve for the number of slots `s_n` (copies) such that
  `P(draw ≥1 card of CMC n by turn n on the play) ≥ 89+n%`, using the **hypergeometric**
  distribution over 70-card / 24-land / 46-slot frame, with a London-style mulligan-keep rule
  (keep hands with ≥2 and ≤5 lands, else mull to 6/5/4) exactly as Karsten's simulations do.
- The solved `{s_1..s_6}` vector is the **template curve**. High n needs fewer copies (you see more
  cards by then); 1-2 drops are the demanding slots (~8-12 copies each at 70-card scale).
- Enforce `Σ s_n = 46`; any remaining slots go to the lowest-CMC buckets first (cheap filler), then
  nudge up.

### Step 3 — Card selection (greedy by role, with copy cap)
- Classify every faction card into roles: **champion-core** (must-have curve pressure), **removal/
  burn** (Crimson/Lantern), **draw/control** (Gilded), **ramp** (Sunforged), **buffs/purge** (Zealot),
  **utility/artifact** (Colorless), **finisher** (legendary/mythic showcase).
- Fill buckets in role priority order, per CMC slot, **cheapest-to-fill-remaining-slots first but
  never exceeding the slot's `s_n` budget and never 5+ copies** (4-copy hard cap).
- Lean: when two cards tie for a slot, prefer the higher base-metrics champion or the card whose
  keyword suits the archetype (e.g., Crimson prefers Swiftstrike/Quickdraw/Overrun burn shells).
- Honor the 49 protected showcase ids (Legendary/Mythic) when they match the archetype's curve —
  a 5+ showcase card auto-claims its CMC slot if under budget.

### Step 4 — Consistency score (Arena-style hand-smoother validation)
- After selection, **score the finished deck** instead of trusting the template:
  simulate 100k hands under the **MTGA BO1 smoother model** — draw 2 hands, keep the one whose land
  ratio is nearest `24/70`, then apply the mulligan rule. Report:
  - `P(2-5 lands in smoothed opener)` — target ≥ 85% (matches mtgazone field data for 24-land-ish
    decks).
  - `P(hit land drop n by turn n)` on the play for n=1..6 — target table from Karsten (89+n%).
  - `P(castable play on every turn 1..4)` (any 1/2/3/4-drop in hand with enough lands).
- Deck PASSES only if all three targets meet; otherwise the template (Step 2) or role weighting
  (Step 3) is tightened and re-rolled. Failures print the worst statistic so tuning is guided.
- (Future/optional, out of scope now: mirroring the smoother INTO the engine for BO1-vs-BO3 feel —
  this only alters mulligan/game-feel, not deck construction.)

### Step 5 — Hard constraints (unchanged from validate-data, enforced in-code)
- total = 70, lands = 24, non-land = 46, all ids resolve in DB, ≤4 copies/card, slug keys match
  `slug_mappings.js`, format key present, exactly 6 decks per format.
- Do NOT touch `build-cards.js`/engine: deck builder reads card DB, writes `decks.json` only.

---

## 4. Validation / verification after implementation
1. `node deckbuilder.js --dry <faction>` → prints template curve, avgMV, and the Step-4 score table.
2. `node gen_decks.js` → regenerate `decks.json` (12 decks).
3. Full gate: `powershell -ExecutionPolicy Bypass -File verify.ps1` (7 steps incl. C-checks + sims).
4. `node simulate.js 10 medium Classic` + `... Standard` → confirm no floods/stalls; the sim win
   rates should spread sensibly (no faction > ~70% at difficulty-appropriate settings after a
   minimum 30-game sample).
5. New unit checks to add into `recall-style` harness or validate-data (list, not yet written):
   - every deck avgMV within its archetype band (±0.3),
   - `P(2-5 lands) ≥ 85%` under the smoother model for every deck,
   - curve vector `s_n` within ±1 of the solved template per slot.
6. Snapshot + docs update (AGENTS.md rebalance note, notesfc session log) **only after user approval**.

## 5. Open decisions for user
1. **Accept the archaic frame**: 24 lands in 70 is land-slim per Karsten (he'd want ~29-31 lands at
   avgMV ~3). Options: (a) keep 24 fixed and let curves be aggressive (avgMV ≤ ~2.6 — current plan),
   (b) relax the 24-land rule to allow 25-28 lands per deck and update validate-data C-checks, or
   (c) tune engine draw to compensate. Recommend (a) for zero-churn, revisit after meet data.
2. **Smoother in the engine?** The score uses the smoother as a *metric only*. Mirroring it into
   `game.js`/`simulate.js` draw logic is a separate, engine-risky change — recommend deferring.
3. **Scope of "deck builder script"** — a standalone `deckbuilder.js` (recommended, testable in
   isolation) vs. editing `gen_decks.js` in place. Plan assumes standalone module + thin gen_decks
   delegate; confirm if you'd rather fully rewrite gen_decks.js.
4. Whether to auto-include off-faction Colorless lands/cards as splash (current design is
   mono-faction only; Colorless faction is its own deck).

## 6. Files touched (when approved)
- NEW `deckbuilder.js` (core).
- `gen_decks.js` (delegate to deckbuilder; output shape unchanged).
- `decks.json` (regenerated — the only generated artifact changed).
- `validate-data.js` (add Curve/smoother checks = new checks, plus existing C-checks).
- `AGENTS.md` / `notesfc.txt` (session record) — only at checkpoint step with user approval.