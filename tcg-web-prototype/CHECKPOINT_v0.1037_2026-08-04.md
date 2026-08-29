# TCG Prototype — CHECKPOINT v0.1037

**Version:** v0.1037
**Date/Time:** 2026-08-04 (local)
**Status:** Working alpha — Gemini's 10 Omen cards integrated (ids 365-374), flipCost + multi-ability flips + champion-omen flip abilities + non-champion omen cleanup live, combat damage hooks (reduction/inversion) added

> Resume here. This is the canonical checkpoint for resuming work later.
> Always-current agent context lives in `AGENTS.md`; older history lives in `SESSION_HISTORY.md`.

---

## 0. RESUME ACTIVATION (copy & paste to opencode)

```
Resume the TCG Prototype at C:\Users\Blayne\Documents\Default Project.

First read AGENTS.md (live context), then CHECKPOINT_v0.1037_2026-08-04.md (full resume checkpoint), and SESSION_HISTORY.md (archive) if needed.

Current version: v0.1037 (2026-08-04). The CARD SET is now 364 cards (was 354): build-cards.js materializes cards_full.json (LIVE build, what game.js/simulate.js read), cards_full.master.json (frozen MASTER), cards_full.backup.json, cards_full.tentative.json (editable, promote when confident). transformCards() lives ONLY in build-cards.js; game.js/simulate.js read cards_full.json directly. Verify: node -c on all JS clean; node build-cards.js verify shows all 4 copies IDENTICAL; 86/86 mechanic tests pass; sim 40 medium clean.

GEMINI'S 10 OMEN CARDS ARE INTEGRATED (ids 365-374, added to build-cards.js newCards + ominousPatch):
  - 365 Booby-Trapped Treasure (Omen, Crimson, ON_OPPONENT_SPELL, damage_any_target 3)
  - 366 Igneous Berserker (Champion-omen 3/2 Crimson, ON_COMBAT_DAMAGE, flipCost {selfDamage:2}, pump_self_stats 2)
  - 367 Dazzling Reflective Barrier (Omen, Sunforged, ON_COMBAT_DAMAGE, TWO abilities: tap_enemy_champion + ready_champion)
  - 368 Sol-Guard Aegis (Champion-omen 1/5 Sunforged, ON_COMBAT_DAMAGE, flipCost {tapFriendly:1}, reduce_combat_damage_all 1)
  - 369 Grave-Gasp Ambush (Omen, Lantern, ON_ALLY_DIES, TWO abilities: purge_weakest + drain_life)
  - 370 Grave-Binder Korath (Champion-omen 2/3 Lantern, ON_ALLY_DIES, flipCost {sacrificeChampion:1}, return_from_graveyard 1)
  - 371 Grand Heist Substitution (Omen, Gilded, ON_OPPONENT_SPELL, swap_champion)
  - 372 Clockwork Impostor (Champion-omen 2/2 Gilded, END_OF_TURN, flipCost {bounceFriendlyLand:1}, next_card_costs_less 2)
  - 373 Rogue's Loaded Deck (Omen, Colorless, START_OF_TURN, opponent_chooses_purge)
  - 374 Chronos Paradigm Shift (Omen, Colorless, Mythic, END_OF_TURN, invert_stats_all)

NEW ENGINE FEATURES (all mirrored in simulate.js + covered by tests):
  - flipCost DONE: canPayFlipCost()/payFlipCost() with formats selfDamage:N, tapFriendly:N, sacrificeChampion:N, bounceFriendlyLand:N; enforced in BOTH flip paths (flipOmen + processGameEvent). Unpayable => omen stays face-down.
  - Multi-ability flips DONE: getOmenFlipAbilities() returns ALL abilities matching the trigger (cards 367/369 fire 2 abilities per flip).
  - Champion-omen flip ability fires DONE: champion branch now executes its flip ability (e.g. 366 pump, 372 discount); faceDown=false set on flipped champion.
  - Non-champion Omen cleanup DONE: after firing, non-champion omens are removed from battlefield.omens and sent to graveyard (no more lingering face-up ghosts).
  - endTurn auto-flip fix DONE: only END_OF_TURN-triggered (or unset) champion-omens auto-flip at end of turn; ON_COMBAT_DAMAGE / ON_ALLY_DIES champion-omens wait for their trigger.
  - New effects DONE: swap_champion, opponent_chooses_purge, reduce_combat_damage_all (per-turn shield reset in clearEndOfTurnEffects), invert_stats_all (global statsInverted flag; resolveDamageStep uses effective power/toughness).
  - Combat damage hooks DONE: resolveDamageStep uses effPower/effTough (inversion) and reduceFor() (combatDamageReduction per side); both reset in clearEndOfTurnEffects().
  - bounceToHand DONE: now also bounces lands (used by bounceFriendlyLand flip cost).

BACKUP SYSTEM: create a snapshot before major work and at end of session:
  powershell -ExecutionPolicy Bypass -File backups\create-checkpoint.ps1 -Name v0.XXXX
Verify anytime: powershell -ExecutionPolicy Bypass -File backups\verify-checkpoint.ps1
Restore: backups\restore-checkpoint.ps1 (auto-verifies first).

Verify after any change: node -c game.js, node -c simulate.js, node recall_ominous_test.js (86/86), node simulate.js 5 medium. Every game.js change must be mirrored in simulate.js.
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
- Snapshots since v0.1030: v0.1031 (stack anchor), v0.1032 (Gemini stack integration),
  v0.1033 (summoning-sickness rule + OMEN_CARD_PROMPT), v0.1034 (destroy_omen/return_from_exile),
  v0.1035 (build-cards.js pipeline), v0.1036 (runtime patching removed), v0.1036-doc (checkpoint doc).

---

## 1. What This Checkpoint Covers

This checkpoint captures the **integration of Gemini's 10 Omen cards** (ids 365-374) plus the
engine work required to support them:

- **10 new cards added** to `build-cards.js` newCards (the pipeline source of truth) with
  `flipTrigger`, `flipCost` (4 champion-omens), and flip abilities; ids 365-374 (all previously
  free; Gemini's original ids 101-110 all conflicted with existing cards)
- **flipCost mechanic** implemented: optional cost to flip an Omen — selfDamage, tapFriendly,
  sacrificeChampion, bounceFriendlyLand — enforced in both flip paths (flipOmen + processGameEvent)
- **Multi-ability flips**: `getOmenFlipAbilities()` returns ALL abilities matching a trigger,
  so cards can fire 2 abilities on one flip (Dazzling Reflective Barrier 367, Grave-Gasp Ambush 369)
- **Champion-omen flip ability now fires**: both flip paths execute the matching flip ability
  when a champion-omen flips face-up (was only entering the battlefield before)
- **Non-champion Omen cleanup**: after a non-champion Omen fires it is removed from
  `battlefield.omens` and sent to the graveyard (previously lingered face-up forever)
- **endTurn auto-flip fix**: only END_OF_TURN-triggered (or unset-trigger) champion-omens
  auto-flip at end of turn; ON_COMBAT_DAMAGE / ON_ALLY_DIES champion-omens wait for their trigger
- **4 new effects**: `swap_champion`, `opponent_chooses_purge`, `reduce_combat_damage_all`
  (per-turn combat damage shield), `invert_stats_all` (global power/toughness inversion)
- **Combat damage hooks**: resolveDamageStep uses effective power/toughness (inversion) and
  per-side combatDamageReduction; both flags reset in clearEndOfTurnEffects()
- **bounceToHand** extended to also return lands (needed by bounceFriendlyLand flip cost)
- **`faceDown=false` set** on champion-omens flipped via processGameEvent (was missing)
- **Test harness grown** from 37 to 86 tests covering all of the above

---

## 2. Project Snapshot

| File | Purpose | Notes |
|------|---------|-------|
| `game.js` | Main engine: GameState (phases/combat/mana/abilities/AI/UI), CardRenderer, coin toss | ~2870 lines, SYNTAX OK |
| `simulate.js` | Headless AI-vs-AI balance simulator (mirrors game.js) | SYNTAX OK |
| `build-cards.js` | **CARD SET GENERATOR** — embeds transformCards(), writes the 4 cards_full copies | single source of truth; now has 364-card newCards |
| `cards.json` | 331 base card definitions (SOURCE; patched by build-cards.js) | valid JSON |
| `cards_full.json` | **LIVE BUILD** — what game.js/simulate.js read | 364 cards |
| `cards_full.master.json` | **MASTER** — frozen reference | 364 cards |
| `cards_full.backup.json` | Backup of master | 364 cards |
| `cards_full.tentative.json` | **EDITABLE** working copy | 364 cards |
| `decks.json` | 4 pre-made 60-card decks | — |
| `index.html` | Game UI HTML layout (exile zone stacks added) | — |
| `style.css` | Card/UI styling | — |
| `card-prototype.html` / `.css` | MTG-proportion card layout prototype | Phase 7 (DELAYED) |
| `recall_ominous_test.js` | 86-test mechanic harness (Recall/Ominous/sickness/flipCost/flips/effects) | PASS 86/86 |
| `OMEN_STACK_BRIEFING.md` | Engine contract doc for Gemini (stack/flip system) | — |
| `OMEN_CARD_PROMPT.md` | Reusable Gemini prompt: 10 quirky Omen cards | — |
| `AGENTS.md` | opencode agent context (live context) | refreshed to v0.1037 |
| `SESSION_HISTORY.md` | Full session history archive | — |
| `CHECKPOINT_v0.1036_2026-08-04.md` | Previous checkpoint | — |
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
champion-omens), then `node build-cards.js init` to re-seed all four copies. Edit
`cards_full.tentative.json` for stat tweaks → `promote` when confident.

### Verified 2026-08-04 (v0.1037)
- 364 cards: Land=80, Champion=94, Spell=69, Relic=55, Instant=56, Decree=4, Omen=6
- By rarity: Common=105, Uncommon=232, Legendary=13, Rare=5, Mythic=9
- `node build-cards.js verify`: all four copies IDENTICAL
- `node recall_ominous_test.js`: 86/86 PASS
- `node simulate.js 40 medium`: clean, no crashes

---

## 4. Omen / Stack System (live, v0.1037)

- `this.stack = []` + `this.resolvingStack = false` in GameState constructors (both files)
- `resolveStack()` — LIFO, depth limit 100, executes OMEN_EFFECT items
- `processGameEvent(type, payload)` — collects matching face-down omens (filtered by
  `flipTrigger`, `checkOmenCondition`, and now `canPayFlipCost`), flips, pushes abilities to
  stack, resolves
- 5 flip triggers: `START_OF_TURN`, `END_OF_TURN`, `ON_COMBAT_DAMAGE`, `ON_OPPONENT_SPELL`,
  `ON_ALLY_DIES` (evaluateFlipCondition + checkOmenCondition both handle these;
  START/END_OF_TURN filtered by ownerId)
- **flipCost** (NEW): optional cost on an Omen — `{selfDamage:N}`, `{tapFriendly:N}`,
  `{sacrificeChampion:N}`, `{bounceFriendlyLand:N}`. `canPayFlipCost()` gates the flip;
  `payFlipCost()` is applied right before flipping. Enforced in BOTH `flipOmen()` and the
  `processGameEvent()` listener loop. If unpayable, the omen stays face-down.
- **Multi-ability flips** (NEW): `getOmenFlipAbilities(omen, eventType)` returns ALL abilities
  matching the trigger; `flipOmen()` and `processGameEvent()` fire each of them. Cards 367/369
  each have 2 abilities on the same trigger.
- **Champion-omen flip ability fires** (NEW): both the `flipOmen` champion branch and the
  `processGameEvent` champion branch now execute the matching flip ability after moving the
  champion onto the battlefield; `faceDown=false` is set (was missing in processGameEvent).
- **Non-champion Omen cleanup** (NEW): after a non-champion Omen's flip abilities resolve, it
  is spliced out of `battlefield.omens` and pushed to the controller's graveyard.
- **endTurn auto-flip fix** (NEW): the end-of-turn auto-flip in `endTurn()` now only flips
  face-down champion-omens whose `flipTrigger` is `'END_OF_TURN'` or unset; other-trigger
  champion-omens wait for their event.
- **Summoning-sickness rule:** `omen.summoned = omen.turnPlayed === this.turnNumber` at all
  flip sites (flipOmen + processGameEvent loop, both files).
- **Combat damage hooks** (NEW): `resolveDamageStep` uses `effPower(c)`/`effTough(c)`
  (invert when `this.statsInverted`) and `reduceFor(dmg, side)` (subtract
  `side.combatDamageReduction`). Both flags reset in `clearEndOfTurnEffects()`.
- New effects (both engines): `swap_champion`, `opponent_chooses_purge`,
  `reduce_combat_damage_all`, `invert_stats_all`, plus earlier `destroy_omen` and
  `return_from_exile`.
- Exile zone: `player.exile` array, purgeCard(), recall system (Recall N keyword, 2x-cost
  return from exile).
- `bounceToHand` now also returns lands to hand (for `bounceFriendlyLand`).

---

## 5. Omen Design Direction (user rulings — IMPORTANT)

- Omens behave like MTG face-down cards when champion type
- Effects should be quirky/creative, 90s Yu-Gi-Oh animated-series energy; some "wild cards"
  (unusual but not game-breaking); power scales with rarity; no "attack/kill/repeat"
- Champion-omen **flip costs must synergize** with the card, its faction, and its theme
- Colorless + one color is the standard deck composition; behaves like MTG with room for
  expansion in code
- Gemini prompt `OMEN_CARD_PROMPT.md` requests: 2 Crimson, 2 Sunforged, 2 Lantern, 2 Gilded,
  2 Colorless; ~4 Common / 3 Uncommon / 2 Rare / 1 Mythic; 2+ champion-omens with themed
  flip costs; 2+ wild cards; engine-compatible effects/triggers

---

## 6. Known Issues / Watch Items

- **Champion rarity is heuristic**: `transformCards()` recomputes rarity for all non-Mythic
  champions (Sol-Guard Aegis 368 and Grave-Binder Korath 370 were authored Rare but compute to
  Uncommon). Cosmetic only — no gameplay impact. Same for Omen commons (compute to Uncommon).
- **Clockwork Impostor (372) discount timing**: `next_card_costs_less` fires at END_OF_TURN;
  the controller's next untap resets `costDiscount` to 0, so the discount may be wiped before
  use. Known engine timing quirk (pre-existing for end-of-turn cost effects) — balance watch.
- **reduce_combat_damage_all timing**: fires when ON_COMBAT_DAMAGE occurs (during damage step),
  so the reduction applies to *subsequent* combat damage that turn, not the hit that flipped it.
- **Worldtree Ancient (343) "Verdant Blessing"** uses trigger `tap` + effect `pump_all` but
  pump only fires for `static` — dead ability (from earlier audit; unfixed)
- Multi-pip mana costs DEFERRED to 2nd official set (post-release); cost layer stays
  `{color, generic}`
- `reveal_and_buff` listed in the prompt but NOT implemented in the engine — implement if used

---

## 7. Verified Commands

```
node -c game.js                    # PASS
node -c simulate.js                # PASS
node -c build-cards.js             # PASS
node -c recall_ominous_test.js     # PASS
node build-cards.js verify         # PASS (4 copies identical)
node recall_ominous_test.js        # PASS (86/86)
node simulate.js 40 medium         # PASS (no crashes)
```

---

## 8. Next Steps (priority order)

1. **Flip a snapshot for v0.1037** (`backups\create-checkpoint.ps1 -Name v0.1037`)
2. **Balance pass** using simulate.js — the 6 new Omens + 4 champion-omens need aiCardValue /
   AI play tuning; watch flipCost usability (selfDamage/tapFriendly/sacrifice/bounce tradeoffs)
3. **Integrate the 120-card port (365–484)** from GEMINI_MERGE_PROPOSAL.md (multi-pip costs,
   new triggers/effects, design gaps)
4. **Design 24 Zealot cards** (IDs 485–508) — green 5th faction, for equal faction counts
5. **Equal-card-count pass** — balance factions for release
6. **5 basic lands per faction** (IDs 509+) — functionally uniform
7. Phase 7 (UI/card layout integration): DELAYED until further notice
