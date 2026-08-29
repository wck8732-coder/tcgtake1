# TCG Prototype — CHECKPOINT v0.1036

**Version:** v0.1036
**Date/Time:** 2026-08-04 (local)
**Status:** Working alpha — card set pipeline materialized (cards_full.json hard copies), runtime patching removed, Omen stack + summoning-sickness rule live

> Resume here. This is the canonical checkpoint for resuming work later.
> Always-current agent context lives in `AGENTS.md`; older history lives in `SESSION_HISTORY.md`.

---

## 0. RESUME ACTIVATION (copy & paste to opencode)

```
Resume the TCG Prototype at C:\Users\Blayne\Documents\Default Project.

First read AGENTS.md (live context), then CHECKPOINT_v0.1036_2026-08-04.md (full resume checkpoint), and SESSION_HISTORY.md (archive) if needed.

Current version: v0.1036 (2026-08-04). The CARD SET PIPELINE is COMPLETE: build-cards.js materializes the 354-card set into four hard copies — cards_full.json (LIVE build, what game.js/simulate.js read), cards_full.master.json (frozen MASTER reference for checkpoints), cards_full.backup.json (backup of master), cards_full.tentative.json (editable working copy, promote when confident). transformCards() now lives ONLY in build-cards.js (single source of truth); game.js/simulate.js/recall_ominous_test.js all read cards_full.json directly and no longer patch at runtime. Verified: build output == simulate's old transformCards output (byte-identical); node -c clean on all JS; 37/37 mechanic tests pass; sim 5 medium clean; build-cards.js verify reports all 4 copies identical.

Omen/stack system is LIVE: resolveStack(), processGameEvent() with 5 triggers (START_OF_TURN, END_OF_TURN, ON_COMBAT_DAMAGE, ON_OPPONENT_SPELL, ON_ALLY_DIES), checkOmenCondition, getOmenFlipAbility, pushOmenToStack. Summoning-sickness rule: a champion-omen flipped the SAME turn it was played from hand gets summoning sickness (omen.summoned = omen.turnPlayed === this.turnNumber); flipped on a later turn = no sickness. Effects destroy_omen and return_from_exile implemented in both engines.

BACKUP SYSTEM: latest snapshot backups\v0.1036_2026-08-04_2034 (SHA256 manifest). Verify anytime: powershell -ExecutionPolicy Bypass -File backups\verify-checkpoint.ps1. Restore: backups\restore-checkpoint.ps1 (auto-verifies first).

NEXT: Gemini design work is in flight — OMEN_CARD_PROMPT.md was written (10 quirky Omen cards, 2/faction + 2 Colorless, wild cards, themed flip costs) and Gemini's first card came back: 'Booby-Trapped Treasure' (id 101 CONFLICTS — Plague Rat owns 101; needs a new id, e.g. 365+ or a test-card range). When Gemini's 10 cards arrive: add to cards_full.tentative.json, promote to master, keep build in sync (build-cards.js regenerate).

Verify after any change: node -c game.js, node -c simulate.js, node recall_ominous_test.js, node simulate.js 5 medium. Every game.js change must be mirrored in simulate.js. Always snapshot before major work: backups\create-checkpoint.ps1 -Name v0.XXXX.
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
- Tested 2026-08-04: create→verify→tamper-detection→restore all passed.
- Latest snapshot: `backups\v0.1036_2026-08-04_2034`
- Snapshots since v0.1030: v0.1031 (stack anchor), v0.1032 (Gemini stack integration),
  v0.1033 (summoning-sickness rule + OMEN_CARD_PROMPT), v0.1034 (destroy_omen/return_from_exile),
  v0.1035 (build-cards.js pipeline), v0.1036 (runtime patching removed).

---

## 1. What This Checkpoint Covers

This checkpoint captures the **card set materialization pipeline** (the fix for the
long-standing problem that the "real" 354-card set only existed in memory after runtime
patching):

- **build-cards.js** written — embeds `transformCards()` as the single source of truth,
  loads `cards.json` (331 base cards), applies all patches, writes 354 fully-patched cards
  to `cards_full.json` AND seeds master/backup/tentative copies
- **Four hard copies** now exist (see §2) — live build, frozen master, backup, editable
  tentative. `node build-cards.js promote` copies tentative→master (old master→backup)
- **Runtime patching REMOVED** from game.js (~270 lines) and simulate.js (~240 lines);
  both now read `cards_full.json` directly. `recall_ominous_test.js` updated to read it too.
  No `transformCards` references remain in game.js/simulate.js
- **Omen/stack system** confirmed live (integrated earlier): resolveStack, processGameEvent,
  5 flip triggers, checkOmenCondition, getOmenFlipAbility
- **Summoning-sickness rule** applied: champion-omen flipped on a later turn than played
  has NO summoning sickness; same-turn flip keeps it. Verified by 4 focused tests
- **New effects** `destroy_omen` and `return_from_exile` added to both engines (mirrored)

---

## 2. Project Snapshot

| File | Purpose | Notes |
|------|---------|-------|
| `game.js` | Main engine: GameState (phases/combat/mana/abilities/AI/UI), CardRenderer, coin toss | 2744 lines, SYNTAX OK, NO transformCards |
| `simulate.js` | Headless AI-vs-AI balance simulator (mirrors game.js) | 1836 lines, SYNTAX OK, NO transformCards |
| `build-cards.js` | **CARD SET GENERATOR** — embeds transformCards(), writes the 4 cards_full copies | 387 lines, the single source of truth |
| `cards.json` | 331 base card definitions (SOURCE; patched by build-cards.js) | valid JSON, 331 cards, max id 354 |
| `cards_full.json` | **LIVE BUILD** — what game.js/simulate.js read | 354 cards, abilities baked in |
| `cards_full.master.json` | **MASTER** — frozen reference; used in checkpoints/verify | 354 cards, identical to build now |
| `cards_full.backup.json` | Backup of master | 354 cards |
| `cards_full.tentative.json` | **EDITABLE** working copy — edit constantly, promote when confident | 354 cards |
| `decks.json` | 4 pre-made 60-card decks | all factions renamed |
| `index.html` | Game UI HTML layout (exile zone stacks added) | — |
| `style.css` | Card/UI styling | — |
| `card-prototype.html` / `.css` | MTG-proportion card layout prototype | Phase 7 (DELAYED) |
| `recall_ominous_test.js` | 37-test mechanic harness (Recall/Ominous/sickness) | PASS 37/37 |
| `OMEN_STACK_BRIEFING.md` | Engine contract doc for Gemini (stack/flip system) | NEW |
| `OMEN_CARD_PROMPT.md` | Reusable Gemini prompt: 10 quirky Omen cards | NEW |
| `AGENTS.md` | opencode agent context (live context) | refresh to v0.1034+ done |
| `SESSION_HISTORY.md` | Full session history archive | — |
| `CHECKPOINT_v0.1030_2026-08-04.md` | Previous checkpoint | — |
| `opencode.json` | opencode config (providers: groq/nvidia/openrouter) | — |
| `serve.bat` | Local server launcher: `npx http-server . -p 8080 -c-1` | — |
| `rename-factions.js` | Faction-rename script (history) | — |
| `tcgtake1_master_card_database.csv` | Godot 120-card reference DB | reference |
| `GEMINI_MERGE_PROPOSAL.md` | Raw 120-card port doc (365-484 + glossary) | RAW, not integrated |

---

## 3. Card Set Pipeline (how it works now)

```
cards.json (331 base) ──► build-cards.js transformCards() ──► cards_full.json (LIVE, 354)
                                                                     │
                                             ┌──────────┬───────────┴──────────┐
                                       master (frozen)   backup (of master)   tentative (EDIT ME)
```

Commands (`node build-cards.js <cmd>`):
- `build` (default) — regenerate `cards_full.json` from cards.json; seeds the other three
  copies if they don't exist yet
- `init` — force re-seed all four copies from the current build
- `promote` — copy tentative → master (old master → backup); use when comfortable
- `verify` — diff build vs master vs backup vs tentative, print added/missing card IDs

**Rule:** edit `cards_full.tentative.json` for card changes → `promote` when confident.
`cards_full.master.json` is the frozen checkpoint reference. `build-cards.js` output was
verified byte-identical to simulate.js's old `transformCards` result (drift guard).

### Verified 2026-08-04
- 354 cards: Land=80, Champion=90, Spell=69, Relic=55, Instant=56, Decree=4
- By faction: Crimson=72, Sunforged=70, Lantern=72, Gilded=73, Colorless=67
- By rarity: Common=105, Uncommon=223, Legendary=13, Rare=5, Mythic=8
- Build output == simulate transformCards output: IDENTICAL
- `node build-cards.js verify`: all four copies IDENTICAL

---

## 4. Omen / Stack System (live)

- `this.stack = []` + `this.resolvingStack = false` in GameState constructors (both files)
- `resolveStack()` — LIFO, depth limit 100, executes OMEN_EFFECT items
- `processGameEvent(type, payload)` — collects matching face-down omens, pushes abilities
  to stack, resolves
- 5 flip triggers: `START_OF_TURN`, `END_OF_TURN`, `ON_COMBAT_DAMAGE`, `ON_OPPONENT_SPELL`,
  `ON_ALLY_DIES` (evaluateFlipCondition + checkOmenCondition both handle these)
- Non-Champion Omens: flip, resolve flip ability, then REMOVED to graveyard (destroy_omen/
  flip cleanup). Champion-omens move to `battlefield.champions` on flip
- **Summoning-sickness rule (new):** `omen.summoned = omen.turnPlayed === this.turnNumber`
  at all 4 flip sites (flipOmen + processGameEvent loop, both files). `playOmen` records
  `card.turnPlayed = this.turnNumber` (game.js:554)
- New effects (both engines): `destroy_omen` (destroys target/first enemy hidden omen via
  `destroyOmen()` helper), `return_from_exile` (returns N champions from exile to
  battlefield, summoned=true, like graveyard reanimation)
- Exile zone: `player.exile` array, purgeCard(), recall system (Recall N keyword, 2x-cost
  return from exile)

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

- **Booby-Trapped Treasure (Gemini's first card) uses id 101** — CONFLICT (Plague Rat).
  Reassign to a free id before adding. Also flagged: non-Champion omen cleanup confirmed
  working; `damage_any_target` needs no manual target (auto-random) — fine for trap-style
- Worldtree Ancient (343) "Verdant Blessing" uses trigger `tap` + effect `pump_all` but pump
  only fires for `static` — dead ability (from earlier audit; unfixed)
- Multi-pip mana costs DEFERRED to 2nd official set (post-release); cost layer stays
  `{color, generic}`
- `opponent_chooses_purge` and `reveal_and_buff` listed as possible NEW_EFFECTs in the
  prompt but NOT implemented in the engine — implement if Gemini uses them

---

## 7. Verified Commands

```
node -c game.js                    # PASS
node -c simulate.js                # PASS
node -c build-cards.js             # PASS
node -c recall_ominous_test.js     # PASS
node build-cards.js verify         # PASS (4 copies identical)
node recall_ominous_test.js        # PASS (37/37)
node simulate.js 5 medium          # PASS (no crashes)
```

---

## 8. Next Steps (priority order)

1. **Gemini Omen cards** — when the 10 cards come back: fix the id conflict (101 taken),
   drop them into `cards_full.tentative.json`, `promote` to master, `node build-cards.js build`
   to keep the live build in sync. Implement any NEW_EFFECTs Gemini used
2. **Integrate the 120-card port (365–484)** from GEMINI_MERGE_PROPOSAL.md (multi-pip costs,
   new triggers/effects, design gaps)
3. **Design 24 Zealot cards** (IDs 485–508) — green 5th faction, for equal faction counts
4. **Equal-card-count pass** — balance factions for release (Crimson has +1 vs others)
5. **5 basic lands per faction** (IDs 509+) — functionally uniform
6. Phase 7 (UI/card layout integration): DELAYED until further notice
