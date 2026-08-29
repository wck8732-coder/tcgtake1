# TCG Prototype — CHECKPOINT v0.1010

**Version:** v0.1010
**Date/Time:** 2026-08-01 05:04 (local)
**Status:** Working alpha — all 8 plan mechanics implemented, verified

> Resume here. This is the canonical checkpoint for resuming work later.
> Always-current agent context lives in `AGENTS.md`; older history lives in `SESSION_HISTORY.md`.

---

## 0. RESUME ACTIVATION (copy & paste to opencode)

```
Resume the TCG Prototype at C:\Users\Blayne\Documents\Default Project.

First read AGENTS.md (live context), then CHECKPOINT_v0.1010_2026-08-01.md (full resume checkpoint), and SESSION_HISTORY.md (archive) if needed.

Current version: v0.1010 (2026-08-01 05:04). All 8 plan mechanics (Purge/Exile, Reveal, Scry, Discard, Ready, Cost modification, Hidden targeting, Decree type) are implemented in game.js and mirrored in simulate.js, verified (parse OK, 17/17 effect tests, sim clean).

Next steps: 1) Recall N ability, 2) Ominous champion support, 3) Land ramp per faction, 4) Faction->Color + CSV->JSON, 5) Mana symbols, 6) Integrate card layout into game UI, 7) Balance pass.

Verify after any change: node -c game.js, node -c simulate.js, node simulate.js 5 easy. Every game.js change must be mirrored in simulate.js.
```

---

## 1. What This Checkpoint Covers

This checkpoint consolidates the session that delivered the **8 plan-derived mechanics**
from the `tcgtake1` Godot plan into the web prototype, along with the earlier
Champion/Guard/Bastion work completed earlier in the same session. Everything was
mirrored into the headless simulator and verified.

---

## 2. Project Snapshot

| File | Purpose | Size (lines) |
|------|---------|--------------|
| `game.js` | Main engine: GameState (phases/combat/mana/abilities/AI/UI), CardRenderer, transformCards(), coin toss | 2541 |
| `simulate.js` | Headless AI-vs-AI batch balance simulator (mirrors game.js) | 1608 |
| `cards.json` | 331 base cards (patched at runtime by transformCards(); new test cards 355–362) | 331 |
| `decks.json` | 4 pre-made 60-card decks | 4 |
| `index.html` | Game UI (exile zone stacks added) | ~180 |
| `style.css` | Card/UI styling | — |
| `card-prototype.html` / `.css` | MTG-proportion card layout prototype | — |
| `AGENTS.md` | opencode agent context (this file is the live context) | — |
| `SESSION_HISTORY.md` | Full session history archive (renamed from SESSION_SUMMARY.md) | — |
| `CHECKPOINT_v0.1010_2026-08-01.md` | This file — resume checkpoint | — |
| `opencode.json` | opencode config (points at AGENTS.md) | — |
| `serve.bat` | Local server launcher: `npx http-server . -p 8080 -c-1` | — |
| `update-cards.js` | Card data generation script | — |

### Card Data Facts
- 5 factions: Volcano (#E65100), Forest (#2E7D32), Swamp (#6A1B9A), Ocean (#0277BD), Colorless (#546E7A)
- Card type counts in `cards.json`: Land 80, Champion 79, Spell 65, Relic 54, Instant 53
- No base `Enchantment`/`Domain`/`Decree` cards exist in cards.json — Decree is now a supported type via runtime patches; Domain/Omen handled at runtime too
- Plan factions (Crimson Thrones, Lantern Covenant, Sunforged Dominion, Gilded Axiom, Neutral) differ from web factions; no merge done (not in scope)

---

## 3. Work Completed This Session

1. **Champion rename (complete)** — type `Creature` → `Champion` everywhere
   (cards.json, decks.json, game.js, simulate.js, index.html, style.css,
   card-prototype.html, update-cards.js). Methods: `playChampion`, `destroyChampion`,
   `championHasKeyword`; field `battlefield.champions`; effects `bounce_champion`,
   `tap_enemy_champion`, `pump_all_champions`, `damage_all_champions`; events
   `championDestroyed`/`championEntered`; HTML IDs `ai-champions`/`player-champions`.
   Both files parse OK; 5-game sim ran clean.

2. **Guard keyword (complete)** — champion may block up to its current max toughness
   (stackable with bonuses). `keywordDefs` + `keywordMap` entries, `getMaxBlocks()`,
   `getCurrentBlockCount()`, enforcement in `assignBlocker()`, Guard-aware AI blocker
   filtering. Assigned to: Mossback Beetle (62), Vilespawn Spider (109),
   Rustwork Sentinel (163).

3. **Bastion keyword (complete)** — champion may block any number of opposing champions;
   `getMaxBlocks()` returns `Number.MAX_SAFE_INTEGER`. Very rare in set 1. Assigned to:
   Marbleback Turtle (151, Ocean 2/6), Grindstone Guardian (171, Colorless 3/4) —
   upgraded from Guard.

4. **Plan files reviewed** — `D:\xfr\Downloads\tcgtake1\AGENTS.md`, `runtime.txt`,
   `tcgtake1_master_card_database.csv` (120 cards). Derived the 8 missing mechanics.

5. **8 plan mechanics implemented** — see Section 4 below.

---

## 4. Most Recent Changes Implemented (8 Mechanics)

All implemented in `game.js` **and mirrored exactly in `simulate.js`** (established pattern).

### 4.1 Purge + Exile Zone
- `player.exile` array added to `createPlayer()`
- `purgeCard(player, card)` — removes from any zone (graveyard/battlefield/hand) and pushes to exile
- Effects: `purge_target`, `purge_weakest`, `purge_all_enemies`, `purge_hidden`,
  `purge_from_graveyard`, `purge_relic`
- UI: exile zone-stacks (`ai-exile`, `player-exile`) in both info bars; new
  `renderZoneStacks()` renders both grave + exile (graveyard stacks now populated too)

### 4.2 Reveal Mechanic
- `reveal_card` (from hand), `reveal_top_deck` (from deck), `reveal_hidden`
  (flips all face-down enemy Omens face-up via `flipOmen`)

### 4.3 Scry Mechanic
- `scry_1` / `scry_2` / `scry_3` — peek top N of deck, order unchanged (peek-only)

### 4.4 Discard Mechanics
- `draw_then_discard`, `draw_two_discard_one`, `discard_opponent`,
  `draw_then_discard_gain_life` (gain 1 life if discarded card cost ≥ 4)

### 4.5 Ready (Untap) Champions
- `ready_champion`, `ready_two_champions` (also +value/+0 pump, permanent),
  `ready_all_champions`

### 4.6 Cost Modification
- `effectiveCost(player, cost)` applies discount/tax; `consumeCostDiscount(player)`
- Player state: `costDiscount`, `costDiscountUses`, `costTax` — all reset at untap phase
- All play methods (`playChampion/playRelic/playDomain/playOmen/playSpell`) now pay
  effective cost and consume the discount; `onCardClick` and both AI play loops too
- Effects: `next_card_costs_less`, `next_two_cards_cost_less`,
  `next_opponent_card_costs_more`

### 4.7 Hidden Card Targeting
- `hiddenUnits(player)` — face-down Omens
- `damage_hidden` (damages/purges a hidden unit, face damage fallback),
  `purge_hidden` (purge a hidden unit)

### 4.8 Decree Card Type
- `Decree` routes through `playSpell()` (onCast), supported in `onCardClick`, AI play
  (`runAI`/`aiMainPhase`/`playerAutoPlay`), `aiCardValue`, `describeAbility`
- Cost-string rendering already handles `{color, generic}` object format

### New Test Cards (IDs 355–362)
| ID | Card | Type | Effect |
|----|------|------|--------|
| 355 | Decree of Embers | Decree | purge_weakest |
| 356 | Decree of Foresight | Decree | scry_2 |
| 357 | Decree of Renewal | Decree | ready_two_champions (+1/+0) |
| 358 | Decree of Night | Decree | next_card_costs_less (2) + discard_opponent (1) |
| 359 | Arcane Purge | Spell | purge_target |
| 360 | Reveal the Veil | Instant | reveal_hidden |
| 361 | Tactical Rest | Instant | ready_all_champions |
| 362 | Echoing Ward | Instant | next_opponent_card_costs_more (2) |

---

## 5. Verification (all passing)

- `node -c game.js` → OK
- `node -c simulate.js` → OK
- Focused runtime effect test (17/17 PASS): purge_target/weakest/hidden/from_graveyard/relic,
  scry, draw_then_discard, discard_opponent, ready_two_champions, cost discount
  (set/reduce/consume), opponent tax, damage_hidden, reveal_hidden, Decree playable,
  untap resets cost mods
- `node simulate.js 5 easy` → clean (3W/2L, avg 5.8 turns)
- `node simulate.js 10 medium` → clean (7W/3L, avg 7.1 turns)

---

## 6. How To Resume

1. Read `AGENTS.md` for live context, this file for the full checkpoint.
2. Syntax check + quick sim after any change:
   ```
   node -c game.js
   node -c simulate.js
   node simulate.js 5 easy
   ```
3. Launch the web prototype: `serve.bat` (or `npx http-server . -p 8080 -c-1`).
4. Every `game.js` change MUST be mirrored in `simulate.js` (copied transformCards +
   switch cases + AI loops).

### Next Steps (from AGENTS.md)
1. Recall N ability (card-type-specific, exile-based return-to-hand, instant at 2× cost)
2. Ominous champion support (face-down champions)
3. Land ramp abilities per faction
4. Faction→Color mapping + CSV→JSON conversion
5. Finalize mana symbols
6. Integrate MTG card layout into game UI
7. Balance pass using simulate.js

---

## 7. Version History

| Version | Date | Notes |
|---------|------|-------|
| v0.1010 | 2026-08-01 05:04 | Champion rename, Guard, Bastion, 8 plan mechanics, exile UI, Decree type, 8 test cards. Sim verified. |
