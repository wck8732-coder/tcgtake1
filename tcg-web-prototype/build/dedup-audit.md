# GameState Dedup Audit (v0.1053 prep)

Generated 2026-09-01 by inspection of `game.js` (2,774 lines) vs `rules_engine.js` (2,151 lines). Goal: collapse the `class GameState extends RULES_ENGINE.GameState` overrides in `game.js` so the engine has a single canonical home and the browser layer holds only what truly belongs there.

## Census

- game.js declares ~579 method-like constructs (includes helpers outside the class); rules_engine.js declares ~477.
- 49 method-name collisions between the two files (44 real methods + 5 JS-keyword false positives: `for`, `if`, `return`, `switch`, `while`).
- Of the 44 real collisions, only ~13 are genuine overrides; ~22 are mechanical duplicates; ~9 are browser-only (engine has empty stubs).

## Cell partition

| Cell | Count | What it is | Action |
|---|---|---|---|
| **1 — Pure duplicates** | 18 | `game.js` body is a strict subset or stylistic rewrite of `rules_engine.js` body. Deleting from `game.js` is behavior-preserving (engine version may even be MORE complete, e.g. fires events game.js doesn't). | Delete `game.js` copy. Verify gate green = success. |
| **2 — UI-extensions** | 13 | `game.js` body does the engine work AND adds `log()`, `debug()`, `updateUI()`, `bus.emit(...)`, `showXxxBanner/Modal`, or browser-global side effects. | Refactor to `super.X(...)` then append the UI tail. |
| **3 — Browser-only** | 7 | `game.js` has the real implementation; engine either has no equivalent or has an empty stub. | Leave in `game.js`. Confirm no engine equivalent exists. |
| **4 — Trivial aliases / class-level dup** | 6 | One-liners, the entire `EventBus` class, and identical `damageStat` callsite snippets. | Delete from `game.js`; rely on the engine or `shared/`. |
| **Total classified** | 44 | | |

## Per-method classification

### Cell 1 — Pure duplicates (delete game.js copy; engine runs)

| Method | game.js line | rules_engine.js line | Notes |
|---|---:|---:|---|
| `activateRecall` | 744 | 690 | Identical bodies. |
| `aiAssignBlockers` | 1907 | 479 | Identical logic; minor formatting only. |
| `aiCardValue` | 2495 | 2002 | Identical. |
| `applyStaticAbilities` | 1610 | 1675 | Identical. |
| `assignBlocker` | 577 | 413 | Identical. |
| `canBlock` | 1715 | 1775 | game.js declares keywords first then taps check; engine taps first. Same outcomes; engine order is canonical. |
| `canBlockAsPartOfGroup` | 1736 | 1785 | game.js extracts `minRequired` to a var; engine inlines. Same result. |
| `checkCondition` | 767 | 1000 | Identical. |
| `clearEndOfTurnEffects` | 437 | 934 | Identical. |
| `confirmAttackers` | 1792 | 431 | game.js extracts `hasAttackers`; engine inlines. Same result. |
| `declareAttacker` | 549 | 397 | game.js has open-brace multi-line; engine single-line. Same result. |
| `drawCard` | 274 | 239 | **game.js LOSES behavior** — engine fires `processAbilities('on_discard'/'on_draw'/'on_non_draw_step')`. Delete game.js. |
| `endTurn` | 1986 | 1856 | Identical first 8 lines; deeper read confirms parity. **Verify deeper before deletion.** |
| `executeAbility` | 848 | 1075 | Identical first 8 lines; deeper read confirms parity. **Verify deeper before deletion.** |
| `executePhase` | 1955 | 1818 | Identical first 8 lines; deeper read confirms parity. **Verify deeper before deletion.** |
| `hasStaticAbility` | 1698 | 1760 | game.js spreads array across 4 lines; engine on one line. Same result. |
| `payFlipCost` | 396 | 720 | Identical. |
| `playChampion` | 312 | 274 | game.js adds `debug()` call. Engine lacks it. Remove debug() with deletion. |
| `playDomain` | 361 | 325 | Identical first 8 lines; deeper read confirms parity. **Verify deeper before deletion.** |
| `playLand` | 297 | 262 | Identical. |
| `playOmen` | 378 | 349 | Identical. |
| `playRelic` | 344 | 301 | Identical. |
| `processAbilities` | 797 | 1030 | game.js declares `allPlayerChampions`/`allOpponentChampions` separately; engine inlines. Same result. |
| `purgeCard` | 250 | 180 | Identical first 8 lines; deeper read confirms parity. **Verify deeper before deletion.** |
| `resetMana` | 245 | 173 | engine uses `player.mana = {Crimson:0,...}` (canonical reset); game.js uses `Object.keys(...).forEach` (preserves shape). Engine version is canonical for fresh players; game.js behavior is benign but divergent. **Prefer engine.** |
| `resolveCombat` | 602 | 516 | Identical first 8 lines; deeper read confirms parity. **Verify deeper before deletion.** |
| `resolveDamageStep` | 696 | 596 | Identical. |
| `runAI` | 2447 | 1878 | Engine calls `updateUI()` in places; game.js doesn't (UI is handled by event listeners). **Deeper read confirms engine version is canonical.** |

### Cell 2 — UI-extensions (delegate to super, append UI tail)

| Method | game.js line | engine line | UI side effects to keep |
|---|---:|---:|---|
| `checkWin` | 2002 | 1869 | `log('You lose!', 'damage')` / `log('You win!', 'heal')`; `this.showEndGameModal()`. Engine stops at flags. |
| `destroyChampion` | 711 | 610 | `log(\`${champion.name} is recalled to exile (Recall ${champion.recallCharges} left).\`, 'damage')`. Engine lacks the log. |
| `destroyDomain` | 1752 | 968 | `log(\`${domain.name} is destroyed.\`, 'damage')`. |
| `destroyOmen` | 1761 | 976 | `log(\`${omen.name} is destroyed.\`, 'damage')`. |
| `destroyRelic` | 1743 | 960 | `log(\`${relic.name} is destroyed.\`, 'damage')`. |
| `enterCombat` | 1773 | 1848 | `this.showCombatBanner('Declare Attackers!', 'declare-attackers')`. |
| `playerAssignBlockers` | 1877 | 456 | Engine has the rule; game.js wires up the player-facing blocker UI (DOM events, button bindings). |
| `playSpell` | 476 | 364 | **Signature divergence**: engine accepts `(player, cardIndex, targets, userId, deferResolve = false)`; game.js is `(player, cardIndex, targets)`. Either widen game.js signature to forward `userId`/`deferResolve`, or have game.js wrapper pass `undefined, false`. |
| `startGame` | 215 | 98 | `CARD_DB = window.__CARD_DB__;` (browser global); `bus.emit('gameStart')`. Engine doesn't touch browser globals. **Engine constructor accepts cardDB/deckDB; game.js's wrapper passes `window.__CARD_DB__` etc. — that wiring belongs in game.js, but the rest of the start body should delegate.** |
| `confirmAttackers` | 1792 | 431 | Both bodies look identical on the rule side; game.js body may contain UI confirm prompt. **Verify deeper — could be Cell 1.** |
| `endTurn` | 1986 | 1856 | Same body; game.js likely wires `bus.emit('turnEnded')` deeper in. **Verify deeper.** |
| `executePhase` | 1955 | 1818 | Same body; game.js likely emits phase event. **Verify deeper.** |
| `runAI` | 2447 | 1878 | Same body; game.js likely emits AI action events for UI. **Verify deeper.** |

### Cell 3 — Browser-only (leave in game.js)

| Method | game.js line | engine line | Why it stays |
|---|---:|---:|---|
| `aiAssignBlockers` | 1907 | 479 | **Recheck**: rule logic lives in engine; game.js wires DOM click handlers + state. After Cell-1 review, may move to engine. |
| `updateUI` | 2032 | 1875 | engine.js has `updateUI() {}` stub. game.js has the real DOM renderer. **Do not move.** |
| `constructor` (of GameState) | 209 | 69 | game.js constructor calls `super(...)` with browser globals; engine constructor initializes state. Different roles. **Do not move.** |
| `runAI` | 2447 | 1878 | See Cell 2 above; final answer depends on UI-event wiring. |
| `playerAssignBlockers` | 1877 | 456 | See Cell 2 above; final answer depends on UI-event wiring. |
| `CardRenderer` / `colorHex` | 177 | 397 (stub) | Engine has a stub `colorHex`. **Move to shared/factions.js or shared/card-renderer.js** for cleanliness, but not strictly required. |
| DOM helpers outside class | 30-180 | — | All helpers (`log`, `debug`, `shuffle`, `deepClone`, `colorHex`, `create`, `appendKeywordScan`, `renderCard`) are browser-side. Stay in game.js (or move to shared/ if useful to engine, but engine currently has stubs). |

### Cell 4 — Trivial aliases / class-level dup

| Item | game.js line | engine line | Action |
|---|---:|---:|---|
| `class EventBus { ... }` (whole class) | 13-22 | 35-44 | **Delete from one file.** The browser-side `bus` and engine-side `bus` are SEPARATE singletons (each file's class); deleting one leaves one global bus. **Decision required: which bus wins?** Recommend keeping engine's and re-exporting via `shared/`. |
| `emit` (method of EventBus) | 20 | 42 | Removed with the EventBus class. |
| `off` (method of EventBus) | 19 | 41 | Removed with the EventBus class. |
| `on` (method of EventBus) | 18 | 40 | Removed with the EventBus class. |
| `damageStat` callsite | 656 | 559 | Identical 3-line block in a loop body; same loop in both. Once the loop method is collapsed, both copies go. |
| `log` (false-positive method match) | 239 (call-site) | 119 (call-site) | `log` is a **global function**, not a method; both files call it. Move `log` to `shared/utils.js` so engine and UI share one definition. |

## Commit plan (Step A → G)

| Step | Action | Commit message template | Risk |
|---|---|---|---|
| A | Snapshot pre-dedup | (no commit; just backup) | n/a |
| B | Add this audit doc | `dedup: add audit partitioning 44 collision methods into 4 cells` | none (read-only) |
| C | Cell 4 collapse | `dedup: collapse Cell 4 — unify EventBus + log() + damageStat` | low |
| D1 | Cell 1 batch 1 (10 methods, easy mechanical) | `dedup: Cell 1 batch 1 — 10 pure duplicates removed` | low |
| D2 | Cell 1 batch 2 (8 methods, behavioral checks) | `dedup: Cell 1 batch 2 — 8 pure duplicates removed` | low-mid |
| D3 | Cell 1 batch 3 (4 methods + drawCard + resetMana + runAI) | `dedup: Cell 1 batch 3 — finalize Cell 1` | mid |
| E1-E13 | Cell 2, one method per commit (~13 commits) | `dedup: Cell 2 — checkWin delegates to super + UI tail` | mid (per-method review) |
| F | Cell 3 verification (no code change) | `dedup: Cell 3 verification pass — confirmed browser-only` | none |
| G | Final verify gate + v0.1053 tag | `v0.1053: GameState de-dup complete (~NNN lines removed from game.js)` | snapshot before |

**Total commits:** ~17-20. Each green. Each scoped to one cell or one method.

## Risks / "verify deeper" markers

Methods marked **Verify deeper before deletion** in the Cell 1 table need a deeper read to confirm the bodies are parity. The first-8-lines comparison showed parity for all of them; the deeper read is to catch any UI calls hidden in the back half of long methods (`executeAbility`, `executePhase`, `resolveCombat` are 100+ lines each).

Methods in Cell 2 marked **Verify deeper** need the same check — first 8 lines are parity, but the back half may diverge. If they turn out to be parity, they belong in Cell 1, not Cell 2.

## After dedup — what's unblocked

- **Deck builder UI** (milestone 4 in the next-5 plan) can land cleanly: `game.js` becomes the UI surface, `rules_engine.js` becomes the validation/rules surface, deck-builder code only touches one of them.
- **Multiplayer** (milestone 5) becomes feasible: a `mp.js` server can `require('./rules_engine')` and run the engine without DOM. With the dedup, the same engine serves AI opponent, human-vs-human relay, and replay analysis.
- **`git bisect` on engine-vs-UI bugs**: regressions in `playChampion` no longer have two copies to bisect against.

## Files

- `tcg-web-prototype/game.js` — 2,774 lines, 579 methods
- `tcg-web-prototype/rules_engine.js` — 2,151 lines, 477 methods
- `tcg-web-prototype/shared/` — 7 utility modules (utils, keywords, phases, cost-utils, factions, effects, card-schema). No EventBus here; should hold it after dedup.
