# TCG Prototype — Agent Context (v0.1048)

**Current version:** v0.1048 (2026-08-27) — card text/flavor finalization waves + UI scale; foundations complete; 3-goal roadmap active (data integrity, engine correctness, UI stabilization).  
**Current snapshot:** `backups/v0.1048_2026-08-27_1816` (verified intact).  
**Active snapshot:** `backups/v0.1044_module_isolate_final_2026-08-13_1740`

> **READ FIRST:** `notesfc.txt` (root) is the master project handoff — full agenda, 3-goal roadmap with steps/why, the file-locator hierarchy with line anchors, hard anti-drift rules, and the Hermes (secondary agent) onboarding order. Read it before touching any code.  

## Live Files (root)
| File | Purpose |
|---|---|
| `card_database.json` | LIVE card DB — what the game/sim read. **100 Lands + 380 non-land (480 total).** Both Classic and Standard: max 4 copies/card (no rarity caps). Every faction: 8 Rare + 4 Mythic. **Colorless = neutral/artifact (not a faction).** Generated, DO NOT hand-edit. |
| `card_database.master.json` / `.backup.json` / `.tentative.json` | Frozen master, backup, editable working copy. Keep identical via `init`/`verify`. |
| `schema_definitions.json` | Canonical card schema (types, rarities, factions, trigger/effect vocabularies, field schema). Regenerates `shared/card-schema.js`; validated on every build. |
| `cards.json` | SOURCE input for `build-cards.js` (base definitions + newCards patches). Edit here for new/modified cards, then rebuild. |
| `build-cards.js` | Card materializer. Loads `cards.json`, runs embedded `transformCards()` (the ONLY source of truth for card data), writes `card_database.*` + `shared/card-schema.js` + validates against `schema_definitions.json`. **v0.1048:** contains `textPatch`/`flavorPatch` maps (authored display text + italic flavor by card id). |
| `rules_engine.js` | **CANONICAL rules engine** (strict module). Pure engine (no DOM/fs/I/O). Consumed by `simulate.js` (require), `game.js` (extends `RULES_ENGINE.GameState`), `recall_ominous_test.js` (via simulate.js re-export). |
| `game.js` | Browser UI layer. `class GameState extends RULES_ENGINE.GameState` — keeps only UI/async-AI/combat overrides; pure rules inherited. Reads `card_database.json` via `fetch`. Card renderer (v0.1048): `textOverride` via `cardData.text` (keyword tooltips still scanned), `.card-flavor` italic line, pluralization cleaned. |
| `simulate.js` | Headless harness over `rules_engine.js` (AI vs AI). Usage: `node simulate.js [games] [difficulty] [format]`. |
| `slug_mappings.js` | Canonical deck-slug map (faction→slug, strategy blurbs, `slugToFaction`/`factionToSlug`). Consumed by gen_decks.js; deck slug keys must match decks.json. |
| `decks.json` | 70-card format-split decks — **Classic** and **Standard** both max 4 copies/card (no rarity caps). 12 decks (6 Classic + 6 Standard), each exactly 70 cards (24 lands + 46 non-land). gen_decks.js generates format-split decks; rules_engine.js enforces min 70 cards + 4-copy limit. | |
| `recall_ominous_test.js` | 123-test harness for Recall/Ominous/Decree + stack/priority/combat/fatigue rules. Run `node recall_ominous_test.js`. MUST stay green. |
| `tcgtake1/` | 120-card CSV source + Gemini mapping (`mapped_cards.json`, ids 1001-1120) — self-contained provenance bundle. Include `batch01-06.json` (Gemini batch inputs) + `merge_batches.js`/`merge-cards.js` (pipeline) + `INTEGRATION_PLAN.md`. |
| `unity/` | Unity template (Assets/ — proper Unity project layout). Engine logic stubbed (gated on decks rebuild). Data: `Assets/StreamingAssets/cards.json` (480-card, generated from `card_database.json`). Regenerate via `node build-unity-cards.js` or **TCG → Build Unity Card Data**. Godot port deleted (dropped target). |
| `.opencode/plugins/` | `ignore-static-data.js` (blocks reads of huge static data files unless edit intent) + `rotate-keys.js` (key ring + auto-rotation). `.opencode/command/rotate-keys.md` = `/rotate-keys`. |

## Build / Seed / Verify (self-contained)
```powershell
# After editing cards.json or build-cards.js transformCards():
node build-cards.js build      # regenerate card_database.json from cards.json
node build-cards.js init       # (re)seed master/backup/tentative to match current build
node build-cards.js promote    # tentative -> master (old master -> backup)
node build-cards.js verify     # diff build vs master (report drift)

# After editing rules_engine.js / game.js / simulate.js:
node --check rules_engine.js game.js simulate.js   # syntax gate
node recall_ominous_test.js                        # 123 tests, MUST stay green
node simulate.js 10                                # headless AI vs AI sanity
node simulate.js 10 medium Classic                 # Classic format sim
node simulate.js 10 medium Standard                # Standard format sim
node build-unity-cards.js                          # regenerate Unity StreamingAssets data

# OR run the whole suite at once — 7-step gate:
powershell -ExecutionPolicy Bypass -File verify.ps1   # syntax + build identity + 123 tests + validate-data (116) + Classic sim + Standard sim + Unity data

# Snapshot the ENTIRE project before major work:
powershell -ExecutionPolicy Bypass -File backups\create-checkpoint.ps1 -Name v0.XXXX
# Verify a snapshot's integrity (checks MANIFEST.sha256):
powershell -ExecutionPolicy Bypass -File backups\verify-checkpoint.ps1 [-Snapshot <folder>]
# Restore from a snapshot (auto-verifies, refuses corrupt):
powershell -ExecutionPolicy Bypass -File backups\restore-checkpoint.ps1 [-Snapshot <folder>]
```
**Rule:** snapshots are full-project. Always snapshot before edits; verify after.

## Card Data Rules (live)
- **Factions:** Crimson=red/burn, Sunforged=green/ramp, Lantern=black/death, Gilded=blue/control/draw, Zealot=white/buffs+purge. **Colorless = neutral/artifact (not a faction).** Deck slugs use OLD names (`volcano_inferno_aggro`, etc.) but `faction` field is new.
- **Types:** Champion, Spell, Instant, Decree, Relic, Domain, Omen, Land. (Champion = Creature; renamed everywhere in v0.1038.)
- **Mana costs** use `{color, generic}` object format. Lands provide 1 colored mana. `normalizeCost`/`totalCostValue`/`canPayCost`/`payMana` in shared/cost-utils.js (COST.*).
- **transformCards patches:** `spellPatch`/`enchantPatch`/`instantPatch` assign abilities by card id; `kw` adds keyword strings; `championRampPatch`, `recallPatch`, `ominousPatch`, `rareSpells`, `rarityOverride` (NEW v0.1042), `TRIM_IDS` (NEW v0.1042) modify cards. Legendary sets: `legendaryChampionIds` + `legendaryKit`.
- **Authored card text/flavor (v0.1048):** `textPatch`/`flavorPatch` (in build-cards.js transformCards) write optional `text` (final rules text — renderer uses it verbatim; keyword spans/footnotes still scanned) + `flavor` (italic flavor line on the card). Fields declared in `schema_definitions.json`. Engine behavior is UNCHANGED (`abilities` remain canonical for rules). Display-only fixes in `shared/effects.js`: `STRING_EFFECTS` (destroy/bounce enchantment) + pluralization cleanup. **Authoring flow:** add entries to the maps → `node build-cards.js build` + `init` + `verify`. Waves 1-5 shipped (24 + 30 + 30 + 30 + 35); ~239 non-land cards remain on generated text.
- **Keywords** (string abilities, interpreted at runtime by `getKeywords`): Swiftstrike, Quickdraw, Keen Eye, Overrun, Deathshroud, Siphon, Flying, Intimidate, Guard, Bastion, Recall N, Ominous.
- **Omens:** face-down play → flip on trigger (`flipTrigger`); `flipCost` enforced; non-champ omens go to graveyard after firing; champion-omens flip + execute ability. Triggers: END_OF_TURN, ON_COMBAT_DAMAGE, ON_ALLY_DIES, ON_OPPONENT_SPELL, START_OF_TURN.
- **Engine rules (enforced v0.1042):** min deck 70 cards, max 4 copies per card, max hand 7 (capped in draw logic). `buildDeckFromDef` lives in `rules_engine.js` and enforces deck-size + 4-copy limit.
- **Format rules (v0.1045):** Classic and Standard both max 4 copies/card (no rarity caps). 12 decks (6 Classic, 6 Standard), each exactly 70 cards (24 lands + 46 non-land). Format selector in browser start screen; `simulate.js` CLI accepts `[format]` arg. **Verified (v0.1046):** browser format persistence is correct — `selectedFormat` defaults to `'Classic'` (game.js:2376), is set by the format buttons (game.js:2401), and is NOT reset by the difficulty handler (game.js:2391-2398 only sets `selectedDifficulty` + toggles visibility); `launchGame` passes it through (game.js:2475). No localStorage memory by design.
- **Shared modules (UMD):** shared/utils.js, keywords.js, cost-utils.js, phases.js, factions.js, effects.js, card-schema.js. Loaded via `<script>` in index.html (browser) / `require()` in simulate.js. `rules_engine.js` wraps the engine the same way (global `RULES_ENGINE` in browser).
- **Static data protection:** `.opencode/plugins/ignore-static-data.js` blocks full reads/greps/lists of `card_database*.json`, `cards.json`, `decks.json`, `tcgtake1/`, `backups/`, `unity/Assets/StreamingAssets/`, `*.csv`. Unblocked by naming the file in a request (edit intent) or by bounded reads. Use `node -e` filters or grep with a specific pattern instead.

## Current Set State (v0.1042)
- 480 cards: 100 Lands (20×5 factions; Colorless has no colored lands — borrow from others), 380 non-land. **Colorless = neutral/artifact (not a faction).**
- Rarity: Common 175 / Uncommon 208 / Rare 48 / Mythic 24 / Legendary 25.
- Draw pie rebalanced: Colorless draw effects 17→3 (Wanderer's Counsel→scry, Far-Way Merchant→ramp, Hearth of Many Paths→extra land); Gilded is now primary draw color (6 effects).
- All 123 tests pass; 100-game sim clean.

## v0.1048 (2026-08-27) — Card Text/Flavor Finalization (Waves 1-2) + UI Scale
- **New workstream (user priority):** finalize text on EVERY card (rules + MTG-style italic flavor) and scale up the UI ("everything is a bit too small").
- **UI scale (style.css):** board cards **140×196** (was 100×140), fonts up ~35%; start screen, zone headers, mana orbs, hand rows, graveyard stack, battlefield, keyword tooltips, modal (300×420), mulligan preview (150×210), blocker defenders, combat banner, coin toss, action log, phase/center bars all rescaled.
- **Authoring pipeline (display-only, engine-unchanged):** `textPatch`/`flavorPatch` maps in `build-cards.js`; renderer override via `cardData.text` (verbatim, keyword spans + footnotes still scanned) + `.card-flavor` italic line (hidden when face-down); schema fields `text`/`flavor` added to `schema_definitions.json`. `transformCards()` still lives ONLY in build-cards.js (stale pre-refactor "3 byte-identical copies" doc note removed from notesfc).
- **Display fix (shared/effects.js):** `STRING_EFFECTS` maps `destroy_enchantment`/`bounce_enchantment`; pluralization cleaned across `draw_cards`/`create_token`/`bounce_enemies`/`discard_opponent`/`return_from_graveyard`/`return_from_exile`/`opponent_chooses_purge`/`sacrifice_then_draw` ("Draw a card." / "Draw 2 cards." / "Create 2 2/2 Saprolings.").
- **Waves shipped:** Wave 1 = 24 cards (all leaked-engine-id renderings fixed: 70/74/104 destroy_enchantment, 152/153 bounce_enchantment; legends 341/343/345/1095; omens 365/373; decree 355/1011; relic 1060; etc.). Wave 2 = 30 cards (all deck-pool; fixed every `pump stats`/`pump self stats` leak: 1059 Vanguard Spearline, 1065 Alexander the Great, 1036, 1084, 1113; cleaned 1041/1047/1017/1071/149/145/353/1089/1097; straight-texted instants/spells + flavor-only on keyword staples). Wave 3 = 30 cards (all 11 Domains, 10 Omens, showcase leaders Emberheart Titan/Plague Sovereign/Leviathan/Tidal Sovereign/Verdant Sovereign/Magma Titan/Grave-Binder Korath/Archive of Endings/Chronarch Selene). Wave 4 = 30 cards (Relics across all factions: 11 Colorless + 7 Crimson + 5 Gilded + 4 Lantern + 3 Sunforged; fixed `pump_all_champions`/`this turn` artifacts). Wave 5 = 35 cards (final 29 Relics — **Relic type fully authored** — plus 6 Decrees: 1019 Scarlet Accounting, 356 Decree of Foresight, 358 Decree of Night, 357 Decree of Renewal, 494 Edict of Purity, 499 Grand Inquisition). **141 of 380 authored; ~239 remain on generated text.**
- **Verified (Wave 2 end):** syntax gate, build IDENTICAL, 123/123, validate-data 116/116, Classic + Standard sims clean, Unity data regenerated. Standard sim had one Turn-64 outlier (control stalemate, resolved cleanly). **Checkpoint:** v0.1048 (verified intact).

## v0.1047+ (2026-08-27) — Goal 1 Closure + Goal 2 Wave 2 (response window + combat fixes)
- **Goal 1 (data integrity) CLOSED by Hermes:** audit (38 dead-code patch entries on trimmed ids — harmless), DB/deck validation. `validate-data.js` added (116 checks) and wired into `verify.ps1` as step 4/7 → gate is now 7 steps. Standard rarity-cap bug fixed via `gen_decks.js` `buildDeck()` (caps enforced as deck-total budgets); `decks.json` regenerated (Standard `forest_verdant_stompy` now ≤3 Rares). verify 7/7 green.
- **Goal 2 (stack/priority) — response window (MTGA-mimic):** AI main phases yield only when defender has viable responses. New engine API: `isMaxRarity(card)`, `relaxedTiming(card)` (true for Legendary/Mythic OR recall-keyworded champions), `getViableResponses(player)` (hand Instant/Spell always legal; `zone-effect` entries = relaxed in-window OR own-main-phase; `board-activated` stub empty), `activateRecall(player, card, relaxed)`. `processGameEvent(eventType, payload, deferResolve)` skips the trailing `resolveStack()` so a pending opponent response can be inserted on top of a cast; `playSpell(..., deferResolve)` forwards it. `resolveStack()` gained a depth cap (drain + warn at 100 — no orphaned items).
- **Hybrid response semantics (user rulings):** strict by default (zone effects own-main-phase only), EXCEPT max-rarity cards (Legendary+Mythic) and keyword/activated-ability uses → "relaxed" (any main phase, incl. opponent's cast window). Omen manifestation is a triggered flip, not activation — unaffected.
- **game.js:** `promptForResponse` rewritten (sets `_responding`/`_awaitingResponse`, renders zone-effect recall action buttons in `#response-actions`, unified decline → clear flags + resolve + `setTimeout(runAI, 400)`); `playSpell` closes an open window when the player casts in response (LIFO); `runAI` early-returns while awaiting; duplicate `#response-no-btn` listener and `|| true` blocker handler removed. **Blocker fixes:** deselect now `removeBlocker(atkId, bId)`; capacity check `getCurrentBlockCount(b.id) < getMaxBlocks(b)`; `blocker-done-btn` onclick scoped inside `playerAssignBlockersUI`.
- **Tests:** 96 → 123 (27 new checks: LIFO stack, instant-on-top, fatigue deck-out, blocker reassign/cap, depth-cap drain, max-rarity/relaxed timing, zone-effect legality, in-window relaxed recall, hand-instant viability).
- **Deferred (out of scope):** `board-activated`-ability mechanic contrains `getViableResponses` empty stub; AI never initiates responses (human-only window); no enabled-energy/timing beyond main phases.
- **Verified:** syntax gate, build IDENTICAL, 123/123, validate-data 116/116, Classic + Standard sims clean (no stalls), Unity data regenerated.

## v0.1046 (2026-08-27) — Format Closure + Verify Automation
- **Browser format persistence verified:** `selectedFormat` defaults `'Classic'` (game.js:2376), set by format buttons (game.js:2401), NOT reset by difficulty handler (game.js:2391-2398). `launchGame` passes it through (game.js:2475). No localStorage by design.
- **`verify.ps1`** added (root): one command runs 6-step suite — syntax gate, card build identity, 96-test harness, Classic sim, Standard sim, Unity data regen.
- **Unity stubs updated:** `GameState.cs.Initialize(format)` now takes a format param; stale 60-card pool notes in `build-unity-cards.js` + `unity/README.unity.template.md` removed (now documents 70-card format-split decks).
- **Verified:** syntax clean, build identical, schema 0 violations, 96/96, Classic + Standard sims clean, Unity data regenerated.
- **Snapshot:** `backups/v0.1046_2026-08-27_0411` (verified intact).

## v0.1043 (2026-08-12) — Project Cleanup + Unity Template
- **Godot port deleted** (dropped target). Removed `godot/` tree (7 files).
- **Project cleanup:** Deleted `archive/` (290 stale pre-architecture checkpoints), redundant backup snapshots (`v0.1039_2021`, `v0.1042_deckrules_trim_rarity_v1`), obsolete docs (`GEMINI_MERGE_PROPOSAL.md` — superseded by `tcgtake1/INTEGRATION_PLAN.md`), orphaned intermediates (`gmmi.json`). Removed orphaned tcgtake1 build scripts (`build-godot-cards.js`, `build-godot-decks.js`, `build-unity-cards.js`). Moved Gemini batch inputs (`batch01-06.json`) into `tcgtake1/` to co-locate with merge pipeline. Verified: build identical, 96/96 tests pass, all 4 cards_full copies identical.
- **Unity template scaffold:** Migrated `unity/scripts/*` → `unity/Assets/Scripts/` (proper Unity layout). Added: `CardDatabaseLoader.cs` (Newtonsoft, id-map — mirrors game.js `__CARD_MAP__`), `GameState.cs`/`CombatEngine.cs`/`CostSystem.cs`/`KeywordSystem.cs`/`PhaseManager.cs` (engine-port stubs). Added `Assets/Editor/CardImporterEditor.cs` (MenuItem → `node build-unity-cards.js`). Added `build-unity-cards.js` (root Node generator: maps `cards_full.json` → `Assets/StreamingAssets/cards.json` in CardDatabase wrapper). All 5 engine stubs are PREPARATION (gated on decks.json rebuild). Data generated: 480 cards, 6 factions (incl. Zealot). Dependency: `com.unity.nuget.newtonsoft-json` via UPM. **v0.1046:** `GameState.cs.Initialize(format)` now takes a format param ('Classic'/'Standard'); deck loader TODO reads `deckDB.formats[format].decks`.
- **decks.json:** 70-card format-split decks — **Classic** (max 4 copies/card) and **Standard** (rarity caps: Legendary x1, Mythic x2, Rare x3). 12 decks (6 Classic + 6 Standard), each exactly 70 cards (24 lands + 46 non-land). v0.1045 change from DEFERRED; gen_decks.js generates format-split decks; rules_engine.js enforces min 70 cards + 4-copy limit.
- **Security finding:** `opencode.json` contains 5 live API keys (provocative pk-prov-..., groq gsk_..., nvidia nvapi-..., openrouter sk-or-v1-... ×2). `opencodec.json` is a redacted duplicate. Recommend: rotate all 5 keys, redact `opencode.json`, delete `opencodec.json`. — **REQUIRES USER ACTION.**
- v0.1041: Zealot faction integrated (ids 485-581).
- v0.1040: 120-card merge (ids 1001-1120), `providesMana:null` normalization, unique ability names to fix oncePerTurn collision, Shroud-Bound Noble rename (363) to free `Restless Noble` (1007).
- v0.1039: Architecture refactor — shared/ modules, modularization (game.js 2890→2479, simulate.js 1966→1777), stale files archived.
- v0.1038: Creature→Champion rename, Exile/Purge zone, Omen type, Decree type, phase-window + colored mana system, Guard/Bastion keywords, Recall N, flipCost, 96-test harness.
- **v0.1045 (2026-08-27) — Classic/Standard Formats + Module Isolation + Key Rotation:**
- **Format definitions:** `slug_mappings.js` added `Classic` (maxCopies: 4) and `Standard` (rarityCaps: Legendary 1, Mythic 2, Rare 3).
- **Deck generation:** `gen_decks.js` rewritten to generate 12 decks (6 Classic, 6 Standard); all decks exactly 70 cards (24 lands + 46 non-land), with format field and rarity caps enforced.
- **`decks.json` shape:** changed from flat 60-card pools to `{ formats: { Classic: { decks: {...} }, Standard: { decks: {...} } } }`.
- **`rules_engine.js`** — `GameState(format)` / `getFormatDecks()` / `getDeckDatabase()` wired.
- **`game.js`** — constructor passes format; format-select buttons set `selectedFormat = 'Classic'` or `'Standard'`.
- **`simulate.js`** — accepts `FORMAT` CLI argument; resolves `formatDecks` from `deckDB.formats`.
- **`build-unity-cards.js`** — regenerated Unity `cards.json` and `decks.json` with format-split 70-card decks.
- **`recall_ominous_test.js`** — 96/96 tests pass unchanged.
- **Verified:** build identical, schema 0 violations, 96/96 tests, 10-game Classic and Standard sims clean.
- **Snapshot:** `backups/v0.1045_formats_classic_standard_2026-08-27_0112` (verified intact).

## v0.1045 (2026-08-27) — Classic/Standard Formats + Module Isolation + Key Rotation
- **Format definitions:** `slug_mappings.js` added `Classic` (maxCopies: 4) and `Standard` (rarityCaps: Legendary 1, Mythic 2, Rare 3).
- **Deck generation:** `gen_decks.js` rewritten to generate 12 decks (6 Classic, 6 Standard); all decks exactly 70 cards (24 lands + 46 non-land), with format field and rarity caps enforced.
- **`decks.json` shape:** changed from flat 60-card pools to `{ formats: { Classic: { decks: {...} }, Standard: { decks: {...} } } }`.
- **`rules_engine.js`** — `GameState(format)` / `getFormatDecks()` / `getDeckDatabase()` wired.
- **`game.js`** — constructor passes format; format-select buttons set `selectedFormat = 'Classic'` or `'Standard'`.
- **`simulate.js`** — accepts `FORMAT` CLI argument; resolves `formatDecks` from `deckDB.formats`.
- **`build-unity-cards.js`** — regenerated Unity `cards.json` and `decks.json` with format-split 70-card decks.
- **`recall_ominous_test.js`** — 96/96 tests pass unchanged.
- **Verified:** build identical, schema 0 violations, 96/96 tests, 10-game Classic and Standard sims clean.
- **Snapshot:** `backups/v0.1045_formats_classic_standard_2026-08-27_0112` (verified intact).
