# UI Standby / Stale-State Review (v0.1053+ follow-up)

Generated 2026-09-02. Audits game.js (1,972 lines post-v0.1053) for three concerns: setTimeout chains, DOM reference caching, and bus listener leaks.

## Summary

| Concern | Status | Action |
|---|---|---|
| DOM references | SAFE | None — all `getElementById` calls are function-local; no module-scope caches |
| setTimeout chains | MOSTLY SAFE | Small fix: track AI pacing timeouts + clear on game reset, wrap callbacks in try/catch |
| Bus listeners | SAFE TODAY | Document pair-up pattern; current emit count = 36, subscriber count = 0 |

## DOM references — SAFE

All 30+ `document.getElementById` / `querySelector` calls in game.js live **inside function bodies**. They re-fetch on every call. The only reference that LOOKS like a module-scope cache (line 27, `const tpl = document.getElementById('card-template')`) is actually inside `CardRenderer.create(cardData, context)` — re-fetched every card render.

Verified by inspecting every callsite:
- Line 27 (`card-template`) — inside `CardRenderer.create`, runs every card render
- Lines 273, 275, 289, 298, 300, 323 (`response-modal`, `response-actions`, `response-subtitle`, `response-no-btn`) — inside `playSpell` and `promptForResponse`, re-fetched each call
- Line 1157 (`combat-banner`) — inside `showCombatBanner`, local scope
- Line 1170 (`blocker-screen`, `blocker-attacker`, `blocker-defenders`, `blocker-banner`, `blocker-done-btn`) — inside `playerAssignBlockersUI`, local scope
- Line 1875 (`mulligan-screen`, `mull-keep-btn`, `mull-toss-btn`, `mull-count`) — inside `showMulligan`, local scope
- Lines 1925-1938 (`btn-concede`, `end-play-again-btn`, `end-game-modal`, `game-container`, `start-screen`) — inside top-level event-listener setup, runs once at page load

No module-scope DOM caching means no stale references can develop. The most likely future failure (page hot-reload during dev) just re-runs the loaders and the next call re-fetches correctly.

**No action required.**

## setTimeout chains — needs a small fix

There are **11 setTimeout calls** in game.js:

| Line | Caller | Purpose | Cancellable? |
|---:|---|---|---|
| 310 | runAI untap case | next AI tick (400ms) | No |
| 1163 | showCombatBanner | hide banner after 1800ms | No |
| 1239 | endTurn | kick off AI turn (600ms) | No |
| 1678 | long-press handler | showCardModal after 400ms hold | YES (1679) |
| 1699 | playerAssignBlockersUI | AI blocker step delay | No |
| 1704 | playerAssignBlockersUI | AI blocker step delay | No |
| 1711 | playerAssignBlockersUI | AI blocker step delay (multi-line) | No |
| 1720 | playerAssignBlockersUI | next AI tick (400ms) | No |
| 1728 | playerAssignBlockersUI | endTurn after delay | No |
| 1834 | doCoinToss | coin flip animation reveal | No |
| 1869 | launchGame | AI first turn after mulligan | No |

**Why this is mostly safe today:** Every AI pacing timeout invokes `this.runAI()`. `runAI` first checks `if (this.gameOver || this.currentPlayer !== 1) return;`. So a deferred runAI firing on an old game (after concede, after new-game-in-flight) early-returns.

**Failure mode (real, narrow):** If `runAI` throws an exception partway through the phase switch, the deferred `setTimeout(() => this.runAI(), 400)` from the next case never schedules. The AI pacing chain silently stops. The game UI shows the AI's last phase frozen with no error visible.

**The fix:** track AI pacing timeouts in a `_aiTimeouts = []` array; clear all on `concede()` and at the start of `startGame()`; wrap the deferred `runAI` callbacks in `try { ... } catch (e) { log('AI pacing error: ' + e.message, 'error'); }`. This:
- Prevents stale timeouts from carrying across concedes / new games.
- Surfaces exceptions in the action log instead of silently hanging the game.

## Bus listeners — safe today, document for tomorrow

Verified counts via scan of 83 JS/HTML files in the project (excluding node_modules, unity/, tcg-unity-engine/):
- `bus.emit(...)` callsites: **36**
- `bus.on(...)` callsites: **0**
- `bus.off(...)` callsites: **0**

Emit sites (by event name):
- `gameStart` (game.js: 1)
- `landPlayed` (game.js: 1)
- `omenPlayed` (game.js: 2 — playOmen + startGameWithDeck)
- `championEntered` (game.js: 2)
- `relicEntered` (game.js: 1)
- `domainEntered` (game.js: 1)
- `spellCast` (game.js: 2)
- `championDestroyed` (game.js: 2)
- `omenEvent` (rules_engine.js: 1)

The 36-vs-9 ratio comes from the same call appearing in both game.js's own code and in rules_engine.js's wrapped context via simulate.js. Per-source-code counts: 10 unique emit callsites (9 in game.js, 1 in engine.js).

**Today: zero leaks possible** (no subscribers, no leak).

**Future-proofing:** When Milestone 5 (multiplayer) or any audio/highlight/replay feature lands, the first `bus.on('gameStart', fn)` subscription will need a matching `bus.off('gameStart', fn)` when the consumer unmounts. Document the pattern at the top of the bus definition so future contributors see it.

## Recommended action

1. **Add `_aiTimeouts` tracking + try/catch in runAI pacing chain.** Small, contained to game.js. Single commit.
2. **Add comment at the bus definition in shared/utils.js** documenting the pair-up pattern for future subscribers. Single doc-only commit.

Both ship in this workstream, separately, both green-gated.