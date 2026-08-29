# OMEN + DOMAIN + STACK — Engine Integration Briefing for Gemini

> Target: `game.js` (browser engine) and its mirror `simulate.js` (headless node sim).
> Every code change MUST land in BOTH files, byte-compatible logic. Browser file has
> DOM/UI calls; simulate.js has no-ops for those.
> Your previous `omen_domain_engine.js` was a good OOP scaffold, but its state model
> does NOT match the real engine. This doc gives you the exact contract to code against.

---

## 1. NON-NEGOTIABLE CONSTRAINTS

1. **Two identical files**: `game.js` and `simulate.js` both define a `class GameState`.
   All new logic must be added as methods on that class (or top-level helpers called by
   it) in BOTH files. No `module.exports` — `game.js` is a browser script; `simulate.js`
   already inlines everything.
2. **Do NOT create a new EventBus.** `game.js:9-16` already has one:
   ```js
   class EventBus {
     constructor() { this.listeners = {}; }
     on(event, fn) { (this.listeners[event] = this.listeners[event] || []).push(fn); }
     off(event, fn) { this.listeners[event] = (this.listeners[event] || []).filter(f => f !== fn); }
     emit(event, data) { (this.listeners[event] || []).forEach(fn => fn(data)); }
   }
   const bus = new EventBus();
   ```
   Extend THIS `bus` with your Omen/stack listeners. Note its `emit(event, data)` takes
   ONE payload arg. `simulate.js:28` has a stub `const bus = { emit() {} }` — replace that
   stub with the same real EventBus when you add listeners there.
3. **Card zones live on `player.battlefield`**, NOT separate `omenZone`/`domainZone`.
   ```js
   battlefield: { champions: [], relics: [], domains: [], lands: [], omens: [] }  // game.js:245
   ```
   Face-down Omens live in `player.battlefield.omens`. Domains in `player.battlefield.domains`.
4. **Card type strings are capitalized singular**: `'Omen'`, `'Domain'`, `'Champion'`,
   `'Relic'`, `'Spell'`, `'Instant'`, `'Decree'`, `'Land'`. NOT `'OMEN'`/`'DOMAIN'`.
5. **Mana is land-based, not a pool.** There is NO `player.mana.generic` counter.
   Mana = untapped lands. Use the existing methods:
   - `normalizeCost(cost)` → `{color, generic}` (game.js:320)
   - `totalCostValue(cost)` → generic + (color?1:0) (game.js:326)
   - `canPayCost(player, cost)` (game.js:340)
   - `payMana(player, cost)` (game.js:346)
   - `effectiveCost(player, cost)` (cost discounts/tax, game.js:374)
   Cost format is `{color, generic}` (e.g. `{generic:2, lantern:1}`).
6. **Ability schema** (game.js:2327 helper `a()`):
   ```js
   { name, trigger, effect, value, oncePerTurn, activationCost,
     ...(token only) tokenPower, tokenToughness, tokenName }
   ```
   Trigger strings are lowercase for existing ones: `enter_battlefield`, `on_cast`,
   `end_of_turn`, `untap`, `attacks`, `dies`, `tap`, `static`, `paid_mana`, `once_per_turn`.
   The 120-set ALSO uses these NEW event triggers (uppercase, your domain): `ON_COMBAT_DAMAGE`,
   `ON_OPPONENT_SPELL`, `ON_ALLY_DIES`, `START_OF_TURN`, `END_OF_TURN`.
7. **Logging**: use existing `log(msg, type)` (game.js:28). No `console.log` for gameplay.
8. **Phase gating exists**: `getPhaseWindows()` (game.js:810) + `isAbilityAllowedInPhase()`
   (game.js:821). Respect it for any trigger you fire.

---

## 2. CURRENT OMEN/DOMAIN STATE (what already works)

- `playOmen(player, cardIndex)` game.js:543 — pays cost, sets `card.faceDown = true`,
  pushes to `battlefield.omens`. (Plays at full `card.cost`, NOT fixed 2.)
- `playDomain(player, cardIndex)` game.js:527 — pays cost, pushes to `battlefield.domains`,
  fires `on_cast`.
- `flipOmen(player, omen)` game.js:559 — Champion-omens move to `battlefield.champions` +
  fire `enter_battlefield`; **BUG**: non-Champion Omens just log "flips face-up!" and
  NEVER execute their flip ability. Fix this.
- `evaluateFlipCondition(perm, triggerType)` game.js:577 — currently returns true ONLY for
  `START_OF_TURN`/`END_OF_TURN`. Extend for `ON_COMBAT_DAMAGE`, `ON_OPPONENT_SPELL`,
  `ON_ALLY_DIES`.
- `checkOmenTriggers(triggerType)` game.js:588 — called at `untap` phase
  (`START_OF_TURN`, game.js:1724) and `end` phase (`END_OF_TURN`, game.js:1735).
- `hiddenUnits(player)` game.js:407 — returns face-down omens. `getSanitizedBoardState`
  game.js:412 already masks opponent face-down omens as generic 2/2 "Face-Down Omen".
- Ominous **champions** (keyword) already deploy face-down and auto-flip at end of
  controller's turn (game.js:1740-1745). Do not break this.
- `reveal_hidden` effect already force-flips ALL hidden omens (game.js:1237-1244).
- Domain static pump already applied via `applyStaticAbilities` (game.js:1397-1415)
  which loops `champions + relics + domains` — a Domain with a `static` `pump_*` ability
  works TODAY. Verify your Domain work doesn't duplicate this.

---

## 3. THE GAP — WHAT YOU MUST BUILD

### 3.1 Ability stack (priority interrupt system)
There is currently NO resolution stack. Effects resolve instantly. Build:
- `this.stack = []` on GameState (constructor, both files).
- A stack item shape you define (e.g. `{type:'OMEN_EFFECT', sourceCard, controller, effect, value, context}`).
- **A true "interrupt"**: when an Omen's event trigger fires during an on-going resolution
  (combat damage, spell cast), its effect must be pushed to the TOP of the stack and
  resolve BEFORE the current resolution continues.
- A resolver `resolveStack()` that pops and executes via the existing `executeAbility`
  path (see 4). Careful: infinite recursion if interrupts trigger more interrupts —
  use a guard / depth limit.

### 3.2 Omen event triggers (wire the hooks)
Add `processGameEvent(eventType, payload)` on GameState that emits into the bus and
flips+stacks any listening face-down omen. Then CALL it at these engine points:

| Event | Where to fire it in game.js |
|---|---|
| `ON_COMBAT_DAMAGE` | in `resolveDamageStep` (game.js:701-746) after each blocker takes damage, and after unblocked damage to face (game.js:727). Payload: `{targetChampion or isFace, targetOwnerId, amount}`. |
| `ON_OPPONENT_SPELL` | inside `playSpell` (game.js:595) after opponent casts a Spell/Instant/Decree. Payload `{spell, casterId}`. |
| `ON_ALLY_DIES` | inside `destroyChampion` (game.js:764) after a friendly champion hits graveyard. Payload `{victim, ownerId}`. |

Only flip for the omen OWNER's relevant side (condition check — your `checkOmenCondition`).

### 3.3 Fix the flip-execution bug
`flipOmen` (game.js:559-575): for non-Champion Omens, after setting `faceDown = false`,
execute the omen's flip-trigger ability (the one whose `trigger` matches the event) via
`executeAbility`, then `applyStaticAbilities(player)`, then `updateUI()`.

### 3.4 Domain work
- Domains already play/enter/static-pump. Add their per-turn lifecycle hooks
  (`end_of_turn`, `untap`, `START_OF_TURN`) — the engine already fires
  `processAbilities('end_of_turn')` (game.js:1734) and `processAbilities('untap')`
  (game.js:1723) so Domain cards whose abilities use those triggers already resolve.
  Confirm, then only add what's actually missing (e.g. Domain `staticAuras` aggregates if
  you want global buffs — reuse `applyStaticAbilities`).
- No "Domain strength" mechanic exists yet. If we keep it: define it, don't invent a
  parallel system.

---

## 4. THE ABILITY EXECUTION PATH (use this, don't duplicate)

- `processAbilities(trigger, context)` game.js:829 — iterates a player's permanents,
  runs matching abilities. `context = {player, card, target}`.
- `executeAbility(ability, source, player, opponent, context)` game.js:879 — the big
  `switch(ability.effect)`. Your stack resolver should route OMEN_EFFECT items through
  `executeAbility` so all existing effects (damage_any_target, bounce, drain, purge,
  create_token, etc.) just work. Effects are STRINGS already listed in game.js:883-1540.

New effects you must ADD to this switch (from the 120-set glossary), in both files:
`grant_swiftstrike_ally`, `buff_crimson_attack`, `pump_stats_target`,
`pump_self_stats`, `sacrifice_then_draw`, `buff_ally_toughness`, `buff_all_allies`,
`double_fire_damage` (design gap — needs damage centralization), `recall_cost_less`.
Plus trigger cases `on_ally_dies`, `on_gain_life`.

---

## 5. THE 120-SET OMEN/DOMAIN CARDS (design targets)

From `GEMINI_MERGE_PROPOSAL.md` — Omens are a card TYPE `'Omen'` with `["Ominous", {ability}]`
where the ability's `trigger` is the event:
- LC20 `ON_ALLY_DIES` → return_from_graveyard
- LC21 `ON_COMBAT_DAMAGE` → drain_all_opponents
- LC22 `END_OF_TURN` → purge_from_graveyard
- SD20 `ON_OPPONENT_SPELL` → ready_all_champions
- SD21 `ON_COMBAT_DAMAGE` → purge_weakest
- SD22 `START_OF_TURN` → scry_2
- GA20 `ON_OPPONENT_SPELL` → bounce_champion
- GA21 `ON_COMBAT_DAMAGE` → tap_enemy_champion
- GA22 `START_OF_TURN` → next_opponent_card_costs_more
- N20 `ON_COMBAT_DAMAGE` → damage_any_target
- N21 `ON_OPPONENT_SPELL` → destroy_relic
- N22 `ON_COMBAT_DAMAGE` → bounce_champion

Domains (type `'Domain'`): LC23, LC24, SD23, SD24, GA23, GA24, N23, N24 — all use existing
triggers `end_of_turn` / `untap` / `static`. Should mostly work with current plumbing.

---

## 6. DELIVERABLE FORMAT

Give me back ONE code block per file that I can drop into BOTH `game.js` and `simulate.js`:

1. **Patch list**: numbered, exact anchor text (copy from the file) + what to insert/replace.
2. **New methods** added to `class GameState` (both files), fully written out:
   - `processGameEvent(eventType, payload)`
   - `resolveStack()`
   - `pushOmenToStack(omen, eventType, payload)`
   - extended `evaluateFlipCondition` + fixed `flipOmen` + `checkOmenTriggers`
   - new `executeAbility` switch cases (4.x list)
   - `this.stack = []` in constructor
3. **EventBus wiring**: which bus events fire and at which engine anchors (3.2 table).
4. **AI (simulate.js)**: if AI should play Omens face-down / value them, note the change
   point in `aiCardValue` (simulate.js:1588 area, `card.type === 'Domain'` → v=4) and
   `aiPlayCard` (simulate.js:1672-1673 area).
5. **No `module.exports`, no new files required.** Everything lands in the two existing files.

---

## 7. VERIFICATION

I will run after integration:
- `node -c game.js` and `node -c simulate.js` (syntax)
- `node recall_ominous_test.js` (33 existing tests must still pass)
- `node simulate.js 10 medium` (batch sim, no crashes/infinite loops)
- A new focused Omen-event test (flip-on-combat, flip-on-opponent-spell,
  flip-on-ally-dies, stack ordering, non-champion omen executes its ability)
