# TCG Prototype — Session History (archive)

> History archive. Latest checkpoint: `CHECKPOINT_v0.1038_2026-08-05.md`.
> Live agent context: `AGENTS.md`.

## Session Log

### 2026-08-11 (v0.1040) — 120-card merge + Gemini config
- Verified Gemini API key works via `GET https://generativelanguage.googleapis.com/v1beta/models?key=...`.
  Added `google` provider (npm `@ai-sdk/google`) to `opencode.json` with the key; default model
  `google/gemini-3.5-flash`; JSON validated. **Action: restart opencode + rotate the exposed key.**
  (`opencodec.json` is a REDACTED orphan — not loaded.)
- Project health check: snapshot `v0.1039_post_architecture_2026-08-10_2021` INTACT; 96/96 tests pass;
  100-game medium sim clean (PvA 52/48, avg 8.4 turns); `build-cards.js verify` was broken
  (master/backup archived) — re-seeded from build.
- Confirmed all 112 new effects + 9 new triggers from the Gemini mapping were ALREADY implemented in
  BOTH engines (game.js 2917, simulate.js 2084); checkCondition covers 12 conditions; all 43 mapped
  effects have `executeAbility` cases + `EFFECTS.describe` text.
- Merge analysis: 120 mapped cards (1001-1120) lack `providesMana`, all 146 object abilities lack
  `name` (30 cards have oncePerTurn → `_usedAbilities` collision risk, esp. 1024 Duchess Vhalora +
  1120 Archivist of the Road with 2 each); 10 Omens use lowercase/no flipTrigger.
- Created snapshot `backups/v0.1040_pre_120card_merge_2026-08-10_2358`.
- New `tcgtake1/merge-cards.js`: normalizes + appends 120 cards into `cards.json` (331 → 451):
  providesMana:null, power/toughness:null for non-champions, unique `ability.name`
  (`CardName: Effect`, numbered on dupes), Omen flipTrigger mapping (on_ally_dies→ON_ALLY_DIES,
  end_of_turn→END_OF_TURN; on_enemy_attack/attacks/on_decree_played→inert uppercase; 5 `static`
  Omens 1032/1085/1104/1110/1117 → converted to `end_of_turn` + END_OF_TURN). Aborts on id conflicts.
- `build-cards.js` transformCards() now returns early for `id >= 1000` to preserve source rarity.
- `node build-cards.js build` → 484 cards (Land 80, Champion 151, Spell 69, Relic 68, Instant 56,
  Decree 32, Omen 16, Domain 12); `init` re-seeded all copies; `verify` → all 4 IDENTICAL.
- 96/96 tests pass; 20-game medium sim clean (11/9, avg 6.5 turns); all 120 mapped cards render
  clean through EFFECTS.describe.
- OPEN ITEM: mapped `Restless Noble` (1007, Crimson) collides with engine 363 (Lantern); id-keyed,
  works, but rename decision pending.

### 2026-08-11 (v0.1040, follow-up) — Name collision resolved
- Renamed engine test card 363 `Restless Noble` → `Shroud-Bound Noble` (Lantern, Recall 1, 3/3, Uncommon)
  in `build-cards.js` `newCards` (line 60). Mapped card 1007 `Restless Noble` (Crimson) keeps the
  tcgtake1 CSV source name. Update mirrored in `recall_ominous_test.js` test label.
- Rebuilt + re-seeded all 4 card copies (`build` + `init`): 484 cards, all identical.
- Verified: only 363/1007 in that name space, zero duplicate non-land names across the set.
- 96/96 tests pass; 20-game medium sim clean (12/8, avg 6.9 turns).


### 2026-08-05 (v0.1038, late) — Pre-handoff full-project audit (new-setup transition)
- Ran a project-wide audit before the user switches to a completely new setup. Results are
  captured in CHECKPOINT_v0.1038 section 6b (HANDOFF AUDIT ADDENDUM) + AGENTS.md hygiene section.
- Confirmed: all 46 card-used effects implemented in BOTH engines; static auras live in the
  re-derivation refresh blocks (game.js ~1395-1406, simulate.js ~1429-1454), not executeAbility.
- describeAbility() text map made COMPLETE: added pump_self_stats, ramp_extra_land,
  pump_stats_target, grant_swiftstrike_ally, buff_crimson_attack, buff_ally_toughness,
  buff_all_allies, recall_cost_less, double_fire_damage, destroy_omen, return_from_exile,
  sacrifice_then_draw (game.js ~95-160). pump_self_stats/ramp_extra_land were on live cards
  366/350 and rendering raw effect names.
- Faction rename confirmed fully migrated (Crimson/Sunforged/Lantern/Gilded/Colorless); old names
  survive only as deck.json slugs + card-prototype.css art classes + pre-v0.1034 docs.
- Inventoried non-live files: AI_BRIEFING.md + WORKFLOW.md (refreshed to current pipeline),
  update-cards.js (legacy one-shot), rename-factions.js (DONE — do not re-run), opencode.json
  (PLAINTEXT API KEYS — rotate), scene.txt (unrelated explicit content — deletion pending),
  GEMINI_MERGE_PROPOSAL.md (TRUNCATED — Track B blocked).
- No TODO/FIXME/HACK markers in any live code file.
- Verified clean after edits: node -c game.js; 4-card DB copies identical; snapshot baseline intact.

---

### 2026-08-05 (v0.1038) — Close the Omen loop (Track A)
- New Omen cards now LIVE in the 4 decks (2 per faction, decks re-trimmed to 60/24 lands):
  Inferno Aggro += 365 Booby-Trapped Treasure x2 + 366 Igneous Berserker x1;
  Verdant Stompy += 367 Dazzling Reflective Barrier x2 + 368 Sol-Guard Aegis x1;
  Death & Decay += 369 Grave-Gasp Ambush x2 + 370 Grave-Binder Korath x1;
  Tidal Control += 371 Grand Heist Substitution x2 + 372 Clockwork Impostor x1
- Colorless Omens 373/374 intentionally NOT decked — saved for a later colorless-Omen implementation
- aiCardValue (game.js + simulate.js) upgraded: Omen effect weights + flipCost penalties
- Clockwork Impostor 372 bug fixed: costDiscount/costTax/recallDiscount resets moved from
  untap phase → clearEndOfTurnEffects (END_OF_TURN-flipped discounts survive to next main)
- Worldtree Ancient 343 dead `pump_all` "Verdant Blessing" removed; cards_full copies re-seeded via `init`
- Tests 86 → 96 (all pass); sim 40 medium clean; snapshot `backups\v0.1038_2026-08-05_1544` verified intact
- Full details: `CHECKPOINT_v0.1038_2026-08-05.md`
- (Intermediate checkpoints v0.1030–v0.1037 each have their own CHECKPOINT_*.md file)

---

### 2026-08-01 (v0.1020) — Recall N + Ominous champions
- Recall N keyword: champion dies/purged → exile instead of graveyard (consumes 1 of N
  charges); pay 2x mana cost (main phase, instant speed) to return from exile to battlefield
- Ominous keyword: champions played face-down as hidden units, flip face-up at end of
  controller's turn (or early via reveal_hidden); flip moves them onto battlefield
- Assigned Recall: Graveshambler 105, Dread Knight 107, Mire Serpent 114, Bloodghast 117,
  Lich Lord 345 (2 charges); Ominous: Mire Horror 104, Festering Zombie 110, Wretched Ghoul 116
- New test cards 363 (Restless Noble, Recall 1) + 364 (Ominous Ghoul)
- Mirror in simulate.js (flipHidden(), recall methods, AI recall in both main phases)
- Verified: both files parse, 33/33 focused mechanic tests, sim clean (5 easy/10 medium/20 easy)
- Full details: `CHECKPOINT_v0.1020_2026-08-01.md`

---

### 2026-08-01 (v0.1010) — Champion rename, Guard/Bastion, 8 plan mechanics
- Champion rename complete (Creature → Champion across all files)
- Guard keyword (block up to toughness) + Bastion keyword (block unlimited)
- Implemented 8 mechanics from the tcgtake1 plan: Purge+Exile zone, Reveal, Scry,
  Discard, Ready (untap), Cost modification, Hidden targeting, Decree card type
- Added 8 test cards (355–362); exile zone UI in both info bars
- Mirrored everything in simulate.js; verified: both files parse, 17/17 effect tests
  pass, sim runs clean (5 easy / 10 medium)
- Full details: `CHECKPOINT_v0.1010_2026-08-01.md`

---

# TCG Prototype — Session Summary (Jul 28, 2026)

## What We're Building
Web-based TCG with 5 factions (Volcano/Forest/Swamp/Ocean/Colorless), 
PvE vs AI, MTG-style mechanics, 60-card decks, 330+ cards.

## Key Files
- `game.js` — Game engine (~2040 lines) + card renderer + transformCards()
- `simulate.js` — Headless AI vs AI batch simulator
- `cards.json` — 331 card definitions
- `decks.json` — 4 pre-made 60-card decks
- `index.html` — Game UI layout
- `style.css` — Current card/UI styling (634 lines)
- `card-prototype.html` + `card-prototype.css` — NEW MTG-proportion prototype
- `SESSION_SUMMARY.md` — This file

## Current State
- All spells/instants/enchantments patched with abilities via transformCards()
- Smart targeting system (face targeting, Escape cancel, AOE auto-cast)
- Coin toss for first player
- describeAbility() renders effect text on cards
- Only 1 vanilla creature: Pistonhammer Dwarf (173)
- Shuffle after deck search (engine + card text)
- MTG-standard card layout designed (prototype files)

## Active Work
- Generating faction mana symbols via AI image generation
- Need: 5 mana symbols + generic mana circle at proper sizes

## Color Palette
| Faction | Primary | Dark | Light | Accent |
|---------|---------|------|-------|--------|
| Volcano | #E65100 | #BF360C | #FF8A65 | #FF6D00 |
| Forest  | #2E7D32 | #1B5E20 | #81C784 | #00C853 |
| Swamp   | #6A1B9A | #4A148C | #CE93D8 | #AA00FF |
| Ocean   | #0277BD | #01579B | #4FC3F7 | #00B0FF |
| Colorless| #546E7A | #37474F | #90A4AE | #B0BEC5 |

## Card Zones (MTG proportions)
Title Bar: Name (left) + Mana Cost (right)
Art Box: ~45% of card height
Type Line: Card type + Expansion symbol (rarity)
Text Box: ~35% — Rules text + Flavor text (italic)
P/T Box: Bottom-right (creatures only)
Info Strip: Artist + Collector number

## Mana Symbol Sizes by Context
- Title bar (cost): 22×22px
- Land tap ability: 18×18px
- Inline rules text: 14×14px
- Game board (small): 10×10px
- Master asset: 64×64px

## Next Steps
1. Finalize 5 faction mana symbols + generic mana circle
2. Integrate symbols into card renderer
3. Generate card art for prototype cards
4. Apply new card layout to game UI
5. Balance pass

---

### 2026-08-12 (v0.1043) — Project Cleanup + Unity Template Scaffold

#### Token-efficiency optimization (card lookups)
- **Problem:** `buildDeckFromDef()` (both game.js and simulate.js) rebuilt `new Map(CARD_DB.map(...))` on every deck-build call — O(n) scan of 480-card library.
- **Fix:** Hoisted id→Map index to load-time. `game.js:2795-2797` now creates `window.__CARD_MAP__` once at fetch time; `simulate.js:58-59` creates `this.CARD_MAP` once at construction. `buildDeckFromDef` references the pre-built map. Pattern matches MTG Arena's "load-all-into-RAM, index-once" approach.
- **Verification:** `node -c game.js` + `node -c simulate.js` pass syntax check. `build-cards.js verify` → all 4 copies IDENTICAL. 96/96 tests pass.

#### Project cleanup (16 operations)
- **Deleted `godot/`** — entire tree (7 files). Godot port dropped; Unity is sole engine target.
- **Deleted `archive/`** — 290 stale pre-refactor checkpoints (v0.1030–v0.1038), already superseded by backups/.
- **Deleted redundant backup snapshots:** `backups/v0.1039_post_architecture_2026-08-10_2021` (near-identical to 1959; 3 extra config artifacts), `backups/v0.1042_deckrules_trim_rarity_v1_2026-08-11_2346` (near-identical to active compact_ready; 1 file diff).
- **Deleted obsolete root files:** `GEMINI_MERGE_PROPOSAL.md` (superseded by `tcgtake1/INTEGRATION_PLAN.md`), `gmmi.json` (orphaned Zealot Gemini intermediate, merged into cards_full.json).
- **Deleted orphaned tcgtake1 build scripts:** `build-godot-cards.js`, `build-godot-decks.js`, `build-unity-cards.js` (now superseded by new Unity template).
- **Co-located Gemini batch inputs:** Moved `batch01.json`–`batch06.json` from root into `tcgtake1/` (co-locate with `merge_batches.js` that consumes them; preserves provenance + cleans root).
- **Pre-cleanup checkpoint:** `backups/v0.1043_pre_cleanup_2026-08-12_1854` (367 files, INTACT via verify-checkpoint).

#### Unity template scaffold (proper Assets/ layout)
- **Migrated** `unity/scripts/*` → `unity/Assets/Scripts/`, `unity/editor/*` → `unity/Assets/Editor/`, removed `unity/data/`.
- **Rewrote CardData.cs:** Full POCO matching `cards_full.json` schema (480 cards). Uses Newtonsoft.Json (JToken for mixed `cost` and `abilities`). Includes Zealot color hex. Dependency: `com.unity.nuget.newtonsoft-json` via UPM.
- **Rewrote CardDatabaseLoader.cs:** Runtime loader using Newtonsoft.Json → `Dictionary<int, CardData>` id-map. Lazy load from `Assets/StreamingAssets/cards.json`.
- **Created engine-port stubs (5 files):** `GameState.cs`, `CombatEngine.cs`, `CostSystem.cs`, `KeywordSystem.cs`, `PhaseManager.cs` — professional stubs with XML doc comments referencing JS port targets. **All stubs gated on decks.json rebuild.**
- **Created `Assets/Editor/CardImporterEditor.cs`:** [MenuItem "TCG/Build Unity Card Data"] spawns root `node build-unity-cards.js`.
- **Created root `build-unity-cards.js`:** Node data generator. Reads `cards_full.json` → writes `Assets/StreamingAssets/cards.json` (CardDatabase wrapper). Also copies `decks.json` with deprecation note.
- **Generated data:** 480 cards, 6 factions (incl. Zealot), rarity counts verified (Common 175 / Uncommon 208 / Rare 48 / Mythic 24 / Legendary 25). `decks.json` shipped as-is (60-card pools — deferred rebuild).
- **Created README.unity.template.md:** Documents structure, Newtonsoft dependency, stub status, data regeneration.

#### decks.json — DEFERRED indefinitely
- Root `decks.json` unchanged (60-card pools, below 70-engine minimum). User rebuilding externally.
- Unity StreamingAssets copies root `decks.json` as placeholder.

#### Security finding (REQUIRES USER ACTION)
- `opencode.json` (162 lines) contains **5 live API keys** (provocative pk-prov-..., groq gsk_..., nvidia nvapi-..., openrouter sk-or-v1-... ×2).
- `opencodec.json` (88 lines) is a redacted duplicate.
- Recommendation: rotate all 5 keys, replace with env-var refs in opencode.json, delete opencodec.json.
- **NOT modified** — secret-bearing file; requires user confirmation.
