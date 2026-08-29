# TCG Prototype — CHECKPOINT v0.1020

**Version:** v0.1020
**Date/Time:** 2026-08-01 (local)
**Status:** Working alpha — Recall N + Ominous champions implemented, verified

> Resume here. This is the canonical checkpoint for resuming work later.
> Always-current agent context lives in `AGENTS.md`; older history lives in `SESSION_HISTORY.md`.

---

## 0. RESUME ACTIVATION (copy & paste to opencode)

```
Resume the TCG Prototype at C:\Users\Blayne\Documents\Default Project.

First read AGENTS.md (live context), then CHECKPOINT_v0.1020_2026-08-01.md (full resume checkpoint), and SESSION_HISTORY.md (archive) if needed.

Current version: v0.1020 (2026-08-01). Recall N (exile-on-death, 2x-cost return to battlefield) and Ominous champions (face-down play, flip at end of turn) are implemented in game.js and mirrored in simulate.js, verified (parse OK, 33/33 mechanic tests, sim clean).

Next steps: 1) Land ramp per faction (ON HOLD until balance pass), 2) Faction->Color mapping + CSV->JSON (draft below, awaiting color assignments), 3) Mana symbols, 4) Integrate card layout into game UI, 5) Balance pass.

Verify after any change: node -c game.js, node -c simulate.js, node simulate.js 5 easy. Every game.js change must be mirrored in simulate.js.
```

---

## 1. What This Checkpoint Covers

This checkpoint adds the **Recall N** and **Ominous** champion mechanics — the first two
mechanics from the plan's keyword list (`D:\xfr\Downloads\tcgtake1\runtime.txt` keywords:
Drain, Guard, Recall X, Omen). Both were implemented in `game.js` **and mirrored exactly
in `simulate.js`**, assigned to existing Swamp champions (the undead/Lantern-Covenant
identity), plus two new test cards (363–364).

---

## 2. Project Snapshot

| File | Purpose | Size (lines) |
|------|---------|--------------|
| `game.js` | Main engine: GameState (phases/combat/mana/abilities/AI/UI), CardRenderer, transformCards(), coin toss | ~2670 |
| `simulate.js` | Headless AI-vs-AI batch balance simulator (mirrors game.js) | ~1700 |
| `cards.json` | 331 base cards (patched at runtime by transformCards(); test cards 355–364) | 331 |
| `decks.json` | 4 pre-made 60-card decks | 4 |
| `index.html` | Game UI HTML layout (exile zone stacks added) | ~180 |
| `style.css` | Card/UI styling | — |
| `card-prototype.html` / `.css` | MTG-proportion card layout prototype | — |
| `AGENTS.md` | opencode agent context (this file is the live context) | — |
| `SESSION_HISTORY.md` | Full session history archive | — |
| `CHECKPOINT_v0.1020_2026-08-01.md` | This file — resume checkpoint | — |
| `opencode.json` | opencode config (points at AGENTS.md) | — |
| `serve.bat` | Local server launcher: `npx http-server . -p 8080 -c-1` | — |
| `update-cards.js` | Card data generation script | — |

### Card Data Facts
- 5 factions: Volcano (#E65100), Forest (#2E7D32), Swamp (#6A1B9A), Ocean (#0277BD), Colorless (#546E7A)
- Card type counts in `cards.json`: Land 80, Champion 79, Spell 65, Relic 54, Instant 53
- Decree/Domain/Omen handled at runtime; Champions can carry Recall N / Ominous keywords
- Recall N assigned: Graveshambler 105, Dread Knight 107, Mire Serpent 114, Bloodghast 117,
  Lich Lord 345 (2 charges), Restless Noble 363 (new)
- Ominous assigned: Mire Horror 104, Festering Zombie 110, Wretched Ghoul 116, Ominous Ghoul 364 (new)

---

## 3. Work Completed This Session

1. **Recall N keyword (complete)** — Champions with Recall N:
   - When destroyed **or purged**, go to exile instead of the graveyard; each such
     occurrence consumes **1 of N charges** (`card.recallCharges`).
   - While in exile, controller may pay **2× the card's mana cost** (`recallCost()`)
     at main-phase speed (`activateRecall()`) to return it to the battlefield
     (summoning sickness applies).
   - Methods: `recallCost(card)`, `recallableFromExile(player)`, `activateRecall(player, card)`.
   - UI: exiled Recall champions are clickable in the player's exile stack (main phases).
   - AI: both AI slots recall the strongest affordable recallable champion each main phase.
   - `getKeywords` recognizes `Recall N` strings; keywordMap + keywordDefs entries added.

2. **Ominous keyword (complete)** — Champions with Ominous:
   - Are played **face-down as hidden units** (stored in `battlefield.omens`), so they
     dodge normal removal and can only be hit by hidden-targeting effects
     (`damage_hidden`/`purge_hidden`) or flipped by `reveal_hidden`.
   - Flip face-up at the **end of their controller's turn** (`endTurn()`), moving onto
     the battlefield as a summoned champion; their enter-battlefield abilities fire on flip.
   - `flipOmen()` (game.js) / `flipHidden()` (simulate.js) handle Champion flips; the
     existing reveal_hidden path now moves flipped champions to the champions zone.
   - AI values Ominous champions slightly lower (delayed deployment).

3. **New test cards (IDs 363–364)**
   | ID | Card | Type | P/T | Effect |
   |----|------|------|-----|--------|
   | 363 | Restless Noble | Champion | 3/3 | Recall 1 |
   | 364 | Ominous Ghoul | Champion | 2/2 | Ominous |

4. **Mechanic test suite** — 33 focused tests (see Section 5).

---

## 4. Design Decisions / Notes

- **Recall returns to BATTLEFIELD** (per user direction), not to hand as the original
  plan ("return it to your hand at end of turn") suggested. Cost is **2× mana cost**.
- **N = number of recall charges** (bounded recursion). Lich Lord 345 gets 2 charges;
  everyone else gets 1. At 0 charges, the champion dies to the graveyard normally.
- **Ominous = always played face-down** for now (matches the "hidden deployment" identity;
  a play-face-up choice could be added later). Flips at end of controller's turn.
- **Theming:** both keywords live on Swamp champions (Crimson Thrones recursion = Recall;
  Lantern Covenant hidden/omen theme = Ominous) per the faction→color direction.
- Land ramp abilities remain **on hold** until the balance pass.

---

## 5. Verification (all passing)

- `node -c game.js` → OK
- `node -c simulate.js` → OK
- Focused runtime test (33/33 PASS): Recall keyword recognition + recallCharges
  (363/117=1, 345=2), death→exile + charge consumption, 0-charge dies to graveyard,
  recallCost=2x, activateRecall pays 2x + returns to battlefield, cannot-recall-without-mana,
  purge consumes charge, Ominous played face-down into omens, counts as hidden unit,
  flips at end of turn onto battlefield (summoned), reveal_hidden flips early,
  damage_hidden purges a face-down champion.
- `node simulate.js 5 easy` → clean (3W/2L, avg 5.4 turns)
- `node simulate.js 10 medium` → clean (7W/3L, avg 6.2 turns)
- `node simulate.js 20 easy` → clean (12W/8L, avg 6.3 turns)

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
1. Land ramp abilities per faction (ON HOLD until balance pass)
2. Faction→Color mapping + CSV→JSON conversion (draft below — awaiting user color assignments)
3. Finalize mana symbols
4. Integrate MTG card layout into game UI
5. Balance pass using simulate.js

---

## 7. Faction → Color Mapping (draft, pending user decisions)

User direction so far:
- Crimson Thrones → Volcano → **Red**
- Lantern Covenant → Swamp → **Black**
- Gilded Axiom → **White** (proposed)
- Neutral / Colorless → **Grey**
- 5th faction (Ocean) → **Blue** ("waterwalkers")

Awaiting user input:
- **Sunforged Dominion** color/theme (suggestion offered in session: see below)
- 5th water faction identity/theme/aesthetic

Open question: how the web factions (Volcano/Forest/Swamp/Ocean/Colorless) and plan
factions (Crimson Thrones/Lantern Covenant/Sunforged Dominion/Gilded Axiom/Neutral)
coexist — merge (rename) vs. two separate sets. Mapping draft is stored here.

---

## 8. Version History

| Version | Date | Notes |
|---------|------|-------|
| v0.1020 | 2026-08-01 | Recall N + Ominous champion keywords, 2 test cards, sim + 33 mechanic tests verified. |
| v0.1010 | 2026-08-01 05:04 | Champion rename, Guard, Bastion, 8 plan mechanics, exile UI, Decree type, 8 test cards. Sim verified. |
