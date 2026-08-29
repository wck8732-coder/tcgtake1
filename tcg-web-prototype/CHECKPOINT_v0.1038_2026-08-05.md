# TCG Prototype — CHECKPOINT v0.1038

**Version:** v0.1038
**Date/Time:** 2026-08-05 (local)
**Status:** Working alpha — new Omen cards now LIVE in the 4 decks, smarter AI Omen valuation, Clockwork discount bug fixed, Worldtree dead ability removed

> Resume here. This is the canonical checkpoint for resuming work later.
> Always-current agent context lives in `AGENTS.md`; older history lives in `SESSION_HISTORY.md`.

---

## 0. RESUME ACTIVATION (copy & paste to opencode)

```
Resume the TCG Prototype at C:\Users\Blayne\Documents\Default Project.

First read AGENTS.md (live context), then CHECKPOINT_v0.1038_2026-08-05.md (full resume checkpoint), and SESSION_HISTORY.md (archive) if needed.

Current version: v0.1038 (2026-08-05). CARD SET is 364 cards (354 base + 10 Omen-era cards 365-374). build-cards.js materializes cards_full.json (LIVE), cards_full.master.json (frozen MASTER), cards_full.backup.json, cards_full.tentative.json. transformCards() lives ONLY in build-cards.js; game.js/simulate.js read cards_full.json directly. Verify: node -c all JS clean; node build-cards.js verify = all 4 copies IDENTICAL; node recall_ominous_test.js = 96/96; node simulate.js 40 medium = clean (no crashes). Baseline snapshot backups\v0.1038_handoff_2026-08-05_1559 verified INTACT (post-audit handoff state).

TRACK A (close the Omen loop) DONE this version:
  - 8 of the 10 new Omen cards added to decks.json, 2 per faction deck, each deck re-trimmed to 60 total (24 lands):
      Inferno Aggro (Crimson): 365 Booby-Trapped Treasure x2, 366 Igneous Berserker x1  (trimmed 29/30/281 by 1 each)
      Verdant Stompy (Sunforged): 367 Dazzling Reflective Barrier x2, 368 Sol-Guard Aegis x1  (trimmed 61/62/291 by 1 each)
      Death & Decay (Lantern): 369 Grave-Gasp Ambush x2, 370 Grave-Binder Korath x1  (trimmed 101/110/117 by 1 each)
      Tidal Control (Gilded): 371 Grand Heist Substitution x2, 372 Clockwork Impostor x1  (trimmed 142/311/312 by 1 each)
    Colorless 373/374 deliberately NOT in any deck — saved for a later colorless-Omen implementation.
  - aiCardValue upgraded in game.js + simulate.js (mirrored): Omen effect weights (invert_stats_all/damage_all/destroy_all +3, purge*/swap_champion/destroy_weakest/destroy_relic/opponent_chooses_purge/reduce_combat_damage_all +2, damage*/draw/draw_then_discard +value, tap/bounce/ready/cost-mod effects +1) + flipCost penalties (sacrificeChampion -2, selfDamage/tapFriendly/bounceFriendlyLand -1).
  - Clockwork Impostor (372) discount bug FIXED: costDiscount/costDiscountUses/costTax/recallDiscount reset moved from the untap phase into clearEndOfTurnEffects (which runs BEFORE the END_OF_TURN flip triggers) in both engines. An END_OF_TURN-flipped discount now survives into your next main phase.
  - Worldtree Ancient (343) dead "Verdant Blessing" ability REMOVED (was trigger:tap + effect:pump_all, which has no engine case). Keeps Worldsprout/Keen Eye/Overrun. Re-seeded all 4 cards_full copies via `init`.
  - Test harness grown 86 -> 96 tests (all passing), covering discount timing, Sol-Guard Aegis tapFriendly gating, and Omen valuation ordering.

VERIFY AFTER ANY CHANGE: node -c game.js, node -c simulate.js, node recall_ominous_test.js (96/96), node build-cards.js verify, node simulate.js 40 medium. Every game.js change must be mirrored in simulate.js.
```

---

## 0b. BACKUP SYSTEM (corruption / data-loss protection)

- `backups/create-checkpoint.ps1` — copies the ENTIRE project (minus `backups/`) into
  `backups\<Name>_<yyyy-MM-dd>_<HHmm>\` and writes a `MANIFEST.sha256` (SHA256 per file).
  Also updates `backups\latest.txt`.
- `backups/verify-checkpoint.ps1` — checks snapshot internal integrity (corruption) AND
  flags live files that changed/deleted vs snapshot. Exit 0 = intact.
- `backups/restore-checkpoint.ps1` — auto-verifies snapshot integrity first, refuses to
  restore a corrupt snapshot, saves a `pre-restore_*` backup, then restores all files.
- Current baseline snapshot: `backups\v0.1038_handoff_2026-08-05_1559` (post-audit handoff state, verified INTACT). Prior snapshot: `v0.1038_2026-08-05_1544`.
- Prior snapshots: v0.1030 through v0.1037 (see SESSION_HISTORY.md for lineage).

---

## 1. What This Checkpoint Covers

This checkpoint captures **Track A — Close the Omen Loop** (v0.1038):

- **New Omen cards now actually see play**: 8 of the 10 cards (365-372) added to the 4 pre-made
  decks (2 per faction deck, matching faction color), each deck re-trimmed to 60 total / 24 lands.
  Colorless Omens 373/374 deliberately left OUT of all decks — saved for a later
  colorless-Omen implementation (per user decision).
- **AI Omen valuation upgraded** in `aiCardValue` (game.js + simulate.js, mirrored): Omens are
  no longer a flat 3 — they now score by their flip effects (invert/destroy-all +3, purge/swap/
  shield +2, damage/draw by value, tap/bounce/ready/cost-mod +1) and are discounted for
  `flipCost` (sacrificeChampion -2, selfDamage/tapFriendly/bounceFriendlyLand -1).
- **Clockwork Impostor discount bug fixed**: `costDiscount`/`costDiscountUses`/`costTax`/
  `recallDiscount` now reset in `clearEndOfTurnEffects()` (end of turn) instead of the untap
  phase. This lets END_OF_TURN-flipped discounts (372's `next_card_costs_less` 2) survive into
  the controller's next main phase, where they can actually be spent.
- **Worldtree Ancient (343) dead ability removed**: the `tap` + `pump_all` "Verdant Blessing"
  ability had no matching engine case; removed. Re-seeded master/backup/tentative via `init`.
- **Test harness grown 86 -> 96** with new tests for discount timing, flipCost gating, and AI
  valuation ordering.

---

## 2. Project Snapshot

| File | Purpose | Notes |
|------|---------|-------|
| `game.js` | Main engine: GameState (phases/combat/mana/abilities/AI/UI), CardRenderer, coin toss | ~2878 lines, SYNTAX OK |
| `simulate.js` | Headless AI-vs-AI balance simulator (mirrors game.js) | SYNTAX OK |
| `build-cards.js` | **CARD SET GENERATOR** — embeds transformCards(), writes the 4 cards_full copies | single source of truth; 364-card newCards |
| `cards.json` | 331 base card definitions (SOURCE; patched by build-cards.js) | valid JSON |
| `cards_full.json` | **LIVE BUILD** — what game.js/simulate.js read | 364 cards |
| `cards_full.master.json` | **MASTER** — frozen reference | 364 cards |
| `cards_full.backup.json` | Backup of master | 364 cards |
| `cards_full.tentative.json` | **EDITABLE** working copy | 364 cards |
| `decks.json` | 4 pre-made 60-card decks (now with 2 new Omen cards each) | totals verified 60/60 |
| `index.html` | Game UI HTML layout (exile zone stacks added) | — |
| `style.css` | Card/UI styling | — |
| `card-prototype.html` / `.css` | MTG-proportion card layout prototype | Phase 7 (DELAYED) |
| `recall_ominous_test.js` | 96-test mechanic harness (Recall/Ominous/sickness/flipCost/flips/effects/valuation) | PASS 96/96 |
| `OMEN_STACK_BRIEFING.md` | Engine contract doc for Gemini (stack/flip system) | — |
| `OMEN_CARD_PROMPT.md` | Reusable Gemini prompt: 10 quirky Omen cards | — |
| `GEMINI_MERGE_PROPOSAL.md` | 120-card port proposal (365-484) — INCOMPLETE doc, needs re-paste | — |
| `AGENTS.md` | opencode agent context (live context) | refreshed to v0.1038 |
| `SESSION_HISTORY.md` | Full session history archive | — |
| `CHECKPOINT_v0.1037_2026-08-04.md` | Previous checkpoint | — |
| `serve.bat` | Local server launcher: `npx http-server . -p 8080 -c-1` | — |

---

## 3. Card Set Pipeline (how it works now)

```
cards.json (331 base) ──► build-cards.js transformCards() ──► cards_full.json (LIVE, 364)
                                                                     │
                                              ┌──────────┬───────────┴──────────┐
                                        master (frozen)   backup (of master)   tentative (EDIT ME)
```

Commands (`node build-cards.js <cmd>`):
- `build` (default) — regenerate `cards_full.json` from cards.json; seeds the other three copies if they don't exist
- `init` — force re-seed all four copies from the current build
- `promote` — copy tentative → master (old master → backup); use when comfortable
- `verify` — diff build vs master vs backup vs tentative, print added/missing card IDs

**Rule for NEW cards:** add to `build-cards.js` `newCards` array (and `ominousPatch` for
champion-omens), then `node build-cards.js init` to re-seed all four copies.

### Verified 2026-08-05 (v0.1038)
- 364 cards: Land=80, Champion=94, Spell=69, Relic=55, Instant=56, Decree=4, Omen=6
- By rarity: Common=105, Uncommon=232, Legendary=13, Rare=5, Mythic=9
- `node build-cards.js verify`: all four copies IDENTICAL (after `init` for the Worldtree change)
- `node recall_ominous_test.js`: 96/96 PASS
- `node simulate.js 40 medium`: clean twice (7/10, 6/10, 7/10, 4/10 then 9/10, 5/10, 8/10, 5/10 win splits; no crashes)

---

## 4. Deck Changes (v0.1038)

| Deck | Faction | Added | Trimmed |
|------|---------|-------|---------|
| Inferno Aggro | Crimson | 365 Booby-Trapped Treasure x2, 366 Igneous Berserker x1 | 29 Tarnished Brute 4→3, 30 Coinflip Imp 4→3, 281 Lava Dart 4→3 |
| Verdant Stompy | Sunforged | 367 Dazzling Reflective Barrier x2, 368 Sol-Guard Aegis x1 | 61 Canopy Scout 3→2, 62 Mossback Beetle 3→2, 291 Giant Growth 4→3 |
| Death & Decay | Lantern | 369 Grave-Gasp Ambush x2, 370 Grave-Binder Korath x1 | 101 Plague Rat 3→2, 110 Festering Zombie 3→2, 117 Bloodghast 4→3 |
| Tidal Control | Gilded | 371 Grand Heist Substitution x2, 372 Clockwork Impostor x1 | 142 Reef Crab 3→2, 311 Boomerang 4→3, 312 Into the Roil 3→2 |

All four decks verified at exactly 60 cards (24 lands + 36 non-land) after edits.

---

## 5. Engine Changes (v0.1038, mirrored in game.js + simulate.js)

- **aiCardValue** (both files): expanded effect-weight table so Omens value their flip effects,
  and added a `flipCost` penalty block (any card with flipCost):
  - +3: `damage_all_enemies`, `destroy_all_enemies`, `invert_stats_all`
  - +2: `purge_target`, `purge_weakest`, `purge_all_enemies`, `purge_hidden`,
    `opponent_chooses_purge`, `swap_champion`, `destroy_weakest_enemy`, `destroy_relic`,
    `reduce_combat_damage_all`
  - +value: `damage_any_target`, `damage_two_targets`, `damage_all_champions`,
    `create_token`, `draw_cards`, `draw_then_discard`
  - +1: `tap_enemy_champion`, `bounce_champion`, `bounce_relic`, `ready_champion`,
    `next_card_costs_less`, `next_two_cards_cost_less`, `next_opponent_card_costs_more`
  - flipCost: sacrificeChampion −2; selfDamage/tapFriendly/bounceFriendlyLand −1
- **costDiscount reset timing fix**: `costDiscount`, `costDiscountUses`, `costTax`,
  `recallDiscount` reset moved OUT of the `untap` phase case and INTO
  `clearEndOfTurnEffects()` (which runs before the END_OF_TURN flip triggers). Clockwork
  Impostor's END_OF_TURN `next_card_costs_less` discount now survives into the next main phase.

---

## 6. Known Issues / Watch Items

- **Champion rarity is heuristic**: `transformCards()` recomputes rarity for all non-Mythic
  champions (Sol-Guard Aegis 368 and Grave-Binder Korath 370 were authored Rare but compute to
  Uncommon). Cosmetic only — no gameplay impact.
- **reduce_combat_damage_all timing**: fires when ON_COMBAT_DAMAGE occurs (during damage step),
  so the reduction applies to *subsequent* combat damage that turn, not the hit that flipped it.
- **One stall outlier** observed in a sim run (1 of 40 games went 54 turns, likely a control
  mirror stall; second run maxed at 15 turns). Not reproducible on rerun — watch if it recurs.
- **Colorless Omens 373/374 in card DB but not in any deck** — deferred to a later
  colorless-Omen implementation (user decision). If fully stripping them is desired, remove from
  build-cards.js newCards + re-`init`.
- Multi-pip mana costs DEFERRED to 2nd official set; cost layer stays `{color, generic}`
- `reveal_and_buff` listed in the Omen prompt but NOT implemented in the engine — implement if used

---

## 6b. HANDOFF AUDIT ADDENDUM (2026-08-05, before new-setup transition)

This addendum captures a full-project audit performed before the user switches to a completely
new setup. It is REQUIRED reading for any agent picking up this project cold.

### Effect / code coverage — VERIFIED
- All 46 effects actually used by cards are implemented in BOTH game.js and simulate.js.
- Static auras `pump_all_champions` / `extra_land_per_turn` / `ramp_extra_land` are handled by
  re-derivation in a refresh block (game.js ~1395-1406, simulate.js ~1429-1454), NOT in
  `executeAbility`. Don't search executeAbility for them.
- describeAbility() effect-text map (game.js ~95-160) made COMPLETE this session: added missing
  text for pump_self_stats, ramp_extra_land, pump_stats_target, grant_swiftstrike_ally,
  buff_crimson_attack, buff_ally_toughness, buff_all_allies, recall_cost_less, double_fire_damage,
  destroy_omen, return_from_exile, sacrifice_then_draw. (pump_self_stats + ramp_extra_land are on
  live cards 366/350; the rest were unimplemented-but-rendered engine effects.)
- NO TODO/FIXME/HACK markers in game.js / simulate.js / build-cards.js / index.html / style.css
  (only matches are placeholder `.art-placeholder.*` classes in card-prototype.css and old docs).
- `node -c game.js` clean after the map edits. simulate.js untouched (headless — no render text).

### Faction rename — CONFIRMED FULLY MIGRATED
- Live data (cards_full.json) + both engines use: Crimson / Sunforged / Lantern / Gilded / Colorless.
- Card counts: Crimson 74, Sunforged 72, Lantern 74, Gilded 75, Colorless 69.
- Live colors (game.js:237): Crimson #c0392b, Sunforged #27ae60, Lantern #000000, Gilded #2980b9,
  Colorless #95a5a6. Deck tabs (game.js:2766): Crimson #e67e22, Lantern #8e44ad.
- Old names (Volcano/Forest/Swamp/Ocean) survive ONLY as: deck.json slugs
  (volcano_inferno_aggro etc.), placeholder art class names in card-prototype.css, and old docs
  (< v0.1034). Treat old names as synonyms for the new ones.
- `rename-factions.js` is a DONE one-shot — do not re-run.

### Files that are NOT what they appear to be
- `AI_BRIEFING.md` — STALE: describes v0.1020 and the cards.json→transformCards() runtime flow
  (pipeline changed to build-cards.js). REFRESHED to current pipeline in this session.
- `WORKFLOW.md` — STALE pipeline references (said transformCards() lives in game.js). UPDATED.
- `update-cards.js` — LEGACY one-shot; hardcoded output path
  `C:/Users/Blayne/AppData/Local/Temp/opencode/cards_new.json`. Do not run blindly.
- `opencode.json` — contains PLAINTEXT API keys (provocative.earth, Groq, NVIDIA). SECURITY:
  rotate/scrub before any external share or backup.
- `scene.txt` — UNRELATED explicit content sitting in the project root; not TCG. Deletion pending
  user decision.
- `GEMINI_MERGE_PROPOSAL.md` — TRUNCATED (missing cards 365-405 + NEW_EFFECT GLOSSARY tail).
  Track B blocked until re-paste. Do not implement from the partial file.
- `OMEN_STACK_BRIEFING.md` / `OMEN_CARD_PROMPT.md` — Gemini-facing design docs; still current.

### Runtime data contract
- game.js fetches `cards_full.json` + `decks.json` (lines ~2746-2747). simulate.js reads them
  (lines ~1887-1888). These two are the LIVE files. Edit via build-cards.js + decks.json.

### Current verified state (after describeAbility edits)
- `node -c game.js` PASS; `node -c simulate.js` PASS; `node build-cards.js verify` 4-copy IDENTICAL;
  `node recall_ominous_test.js` 96/96 (before this edit; map is display-only so unaffected).
- Baseline snapshot `backups\v0.1038_handoff_2026-08-05_1559` created + verified INTACT (captures post-audit docs + describeAbility edits).

---

## 7. Verified Commands

```
node -c game.js                    # PASS
node -c simulate.js                # PASS
node -c build-cards.js             # PASS
node -c recall_ominous_test.js     # PASS
node build-cards.js verify         # PASS (4 copies identical)
node recall_ominous_test.js        # PASS (96/96)
node simulate.js 40 medium         # PASS (no crashes)
backups\verify-checkpoint.ps1 -Snapshot v0.1038_handoff_2026-08-05_1559   # PASS (snapshot intact)
```

---

## 8. Next Steps (priority order)

1. **Balance pass** using simulate.js — now that Omens are in real decks, tune aiCardValue /
   AI play further; watch flipCost usability (selfDamage/tapFriendly/sacrifice/bounce tradeoffs)
   and deck win rates (Tidal Control ran lower in early sims)
2. **Integrate the 120-card port (365–484)** from GEMINI_MERGE_PROPOSAL.md — BLOCKED until the
   incomplete proposal doc is re-pasted (missing Crimson Thrones CT01–24 + Lantern LC01–17 = cards
   365–405, and the truncated NEW_EFFECT GLOSSARY tail). Also needs the 3 open "Pending decisions"
   from the doc resolved
3. **Design 24 Zealot cards** (IDs 485–508) — green 5th faction, for equal faction counts
4. **Equal-card-count pass** — balance factions for release
5. **5 basic lands per faction** (IDs 509+) — functionally uniform
6. **Faction→Color mapping + CSV→JSON conversion** for the Godot reference project
   (`D:\xfr\Downloads\tcgtake1`)
7. Phase 7 (UI/card layout integration): DELAYED until further notice
