# Gemini Prompt: Design the Zealot Faction — Remainder 73 Cards (509-581)

## Context
You are designing the 5th colored faction for a card game: **The Zealots** (color: gold/yellow `#f1c40f`). "Righteous fury" archetype — cards that grow stronger through combat commitment, lifegain, and spiritual devotion. Thematically: zealous holy warriors using fire/light magic.

**Colorless is NOT a faction** — it's just artifacts/neutral (like MTG). The 5 colored factions are: Crimson, Sunforged, Lantern, Gilded, and Zealot.

The 23 hero cards (IDs 485-501, 503-508) are **already designed with art and mechanics** — do NOT create, name, or reuse them. Your job is the **remaining 73 cards (IDs 509-581)** that complete the faction to the same size as the other four.

Each existing colored faction has ~96-99 cards. Zealot target is **96 cards total** (exactly matching Sunforged). After the 23 heroes, the remaining type counts you must fill are:

| Slot | Type | Count |
|------|------|-------|
| 509-519 | Champion | 11 |
| 520-529 | Relic | 10 |
| 530-538 | Spell | 9 |
| 539-547 | Instant | 9 |
| 548-552 | Decree | 5 |
| 553-554 | Omen | 2 |
| 555 | Domain | 1 |
| 556-575 | Land | 20 |
| 576-581 | Champion | 6 |
| **Total** | | **73** |

## Cards (you choose names + mechanics)
Choose thematic Zealot names (masked holy warriors, crusades, prayer, candles, golden light, relics, pilgrimage, martyrdom — NO modern/cyberpunk names).

- **509-519** — 11 Champions
- **520-529** — 10 Relics
- **530-538** — 9 Spells
- **539-547** — 9 Instants
- **548-552** — 5 Decrees
- **553-554** — 2 Omens
- **555**     — 1 Domain
- **556-575** — 20 Lands (name pattern: "Zealot Land" or creative plain variants; type `Land`, `providesMana: 1`, cost `0`)
- **576-581** — 6 Champions

## Instructions

For each card, produce **both formats**:

### A) `cards.json` entry (base format):
```json
{"id":485,"name":"Zealot Vanguard","type":"Champion","cost":2,"power":2,"toughness":2,"providesMana":null,"color":"Zealot","abilities":[],"rarity":"Common"}
```

### B) `build-cards.js` `newCards` entry (fully resolved, for cards needing abilities/keywords/Omen/Recall):
```json
{"id":553,"name":"[YOUR OMEN NAME]","type":"Omen","cost":3,"power":null,"toughness":null,"providesMana":null,"color":"Zealot","rarity":"Uncommon","flipTrigger":"END_OF_TURN","abilities":[{"name":"[Effect Name]","trigger":"END_OF_TURN","effect":"draw_cards","value":2,"oncePerTurn":false,"activationCost":null}],"faceDownCost":{"generic":2}}
```

**Rules:**
- Only use effects, triggers, and keywords from the lists below
- If you need a new effect, mark `[NEW EFFECT NEEDED]` and describe it
- For Champions: provide `power`/`toughness`
- For Spells/Instants/Decrees/Relics/Domains/Omens/Lands: `power`/`toughness` = `null`
- For Omens: include `flipTrigger` (one of: `END_OF_TURN`, `ON_COMBAT_DAMAGE`, `ON_OPPONENT_SPELL`, `ON_ALLY_DIES`, `START_OF_TURN`) and `faceDownCost` (default `{"generic":2}`)
- For Recall: include `recallCharges: N` and add `"Recall N"` to abilities
- For keywords: list as strings (e.g., `"Guard"`, `"Flying"`, `"Swiftstrike"`)
- `stat_change_target` uses `attackDelta` (and optionally `lifeDelta`) — NOT `value`
- **Rarity note:** the engine recomputes rarity for non-Mythic id < 1000 cards, so rarity here is advisory. Mark obvious bombs as `Mythic` to force-preserve them; mark legendary-flavored champions `Legendary` (I'll wire their legendary kits). Target rarity spread: ~1 Mythic, ~2-3 Legendary, ~6-8 Rare, ~10-12 Uncommon, rest Common.
- **Mana curve details can be adjusted later** — focus on correct mechanics, effects, and P/T. Follow standard curve: most 1-drops are 1/2 or 2/1, 2-drops ~2/2-2/3, 3-drops ~3/2-3/3, higher cost = higher stats.

## Available Effects (use ONLY these)

### Damage
- `damage_all_enemies` (value=N) — Deal N damage to all enemy champions
- `damage_any_target` (value=N) — Deal N damage to any target (champion or face)
- `damage_random_enemy` (value=N) — Deal N damage to a random enemy
- `damage_two_targets` (value=N) — Deal N damage to two targets
- `damage_all_champions` (value=N) — Deal N damage to ALL champions
- `damage_relic` (value=N) — Deal N damage to target relic
- `damage_hidden` (value=N) — Deal N damage to a hidden enemy unit

### Destruction / Removal
- `destroy_all_enemies` — Destroy all enemy champions
- `destroy_weakest_enemy` (value=N) — Destroy weakest enemy (N=delay, usually 0)
- `destroy_relic` — Destroy target relic
- `destroy_omen` — Destroy target hidden face-down card
- `destroy_all` — Destroy all champions

### Bounce
- `bounce_enemies` (value=N) — Return N enemy champions to hand
- `bounce_all_enemies` — Return all enemy champions to hand
- `bounce_two_enemies` — Return 2 enemy champions to hand
- `bounce_relic` — Return target relic to hand
- `bounce_champion` — Return target champion to hand

### Card Advantage
- `draw_cards` (value=N) — Draw N cards
- `return_from_graveyard` (value=N) — Return N champions from graveyard to battlefield
- `return_from_exile` (value=N) — Return N champions from exile to hand

### Champion Control
- `swap_champion` (value=N) — Swap control of enemy champion and friendly champion
- `opponent_chooses_purge` (value=N) — Opponent purges N of their own champions

### Defense
- `reduce_combat_damage_all` (value=N) — Reduce all combat damage to your side by N this turn
- `invert_stats_all` (value=N) — Invert all champions' power/toughness this turn

### Life Gain / Drain
- `drain_life` (value=N) — Deal N damage, gain N life
- `drain_all_opponents` (value=N) — Drain N from each opponent
- `gain_life` (value=N) — Gain N life

### Tap / Ready
- `tap_enemy_champion` (value=N) — Tap enemy champion
- `ready_champion` (value=N) — Ready target friendly champion
- `ready_two_champions` (value=N) — Ready up to two friendly champions
- `ready_all_champions` — Ready all friendly champions

### Sacrifice
- `sacrifice_then_damage` (value=N) — Sacrifice a champion: deal N damage
- `sacrifice_then_draw` (value=N) — Sacrifice a champion: draw N cards

### Ramp
- `ramp_search_land` (value=N) — Search deck for N basic land, put into play
- `ramp_extra_land` (value=N) — Play N additional land this turn
- `extra_land_per_turn` (value=N) — Play 1 additional land each turn

### Tokens
- `create_token` (value=N, tokenPower, tokenToughness, tokenName) — Create N tokens

### Purge
- `purge_target` — Purge target enemy champion
- `purge_weakest` — Purge weakest enemy champion
- `purge_all_enemies` — Purge all enemy champions
- `purge_hidden` — Purge a hidden enemy unit
- `purge_from_graveyard` — Purge a card from target graveyard
- `purge_relic` — Purge target relic

### Reveal
- `reveal_card` — Reveal a card from your hand
- `reveal_top_deck` — Reveal top card of deck
- `reveal_hidden` — Reveal all hidden enemy cards

### Scry
- `scry_1` / `scry_2` / `scry_3` — Scry 1/2/3

### Draw/Discard
- `draw_then_discard` — Draw a card, then discard a card
- `draw_two_discard_one` — Draw two, discard one
- `discard_opponent` (value=N) — Opponent discards N cards
- `draw_then_discard_gain_life` (value=N) — Draw, discard; if discarded card costs N+, gain 1 life

### Buff / Conditional
- `pump_all_champions` (value=N) — All your champions get +N/+N this turn
- `buff_all_allies` (value=N) — All your champions get +N/+N this turn
- `buff_ally_toughness` (value=N) — Your other champions get +N toughness
- `pump_self_stats` (value=N) — This champion gets +N/+N this turn
- `pump_stats_target` (value=N) — Target unit gets +N attack this turn
- `grant_swiftstrike_ally` (value=N) — Target ally gains Swiftstrike until EOT
- `double_fire_damage` — Your red champions deal double combat damage
- `recall_cost_less` (value=N) — Your Recall costs N less

### Conditional / Once-per-turn / Utility
- `each_player_lose_1` (value=N) — Each player loses N life
- `drain_heal_extra` (value=N) — Your Drain effects heal N extra
- `first_ally_dies_return_hand` — First ally that dies returns to hand at EOT
- `omen_return_ally_with_1_life` — At EOT, if an ally died, return it with 1 life
- `stat_change_target` (attackDelta=N, lifeDelta=N) — Target gets +N attack (or toughness) this turn
- `first_purge_cost_less` (value=N) — Your first purge each turn costs N less
- `grant_guard_until_next_turn` — Champions entering this turn gain Guard until next turn
- `grant_guard_self_if_two_plus_attack` — When attacking with 2+ allies, gain Guard EOT
- `grant_guard_all_champions` — Your champions gain Guard EOT
- `next_decree_triggers_twice` — Next Decree triggers twice
- `omen_draw_gain_life_if_neutral` — Draw a card, if neutral gain 1 life
- `first_discard_cost_less` (value=N) — First discard each turn costs N less
- `omen_choice_draw_or_damage` (value=N) — Choose: draw card or deal N damage
- `choose_faction_conditional_attack` (value=N) — Choose faction; this gets +N attack while you control that faction
- `next_card_costs_less` (value=N) — Next card costs N less
- `next_two_cards_cost_less` (value=N) — Next two cards cost N less each
- `next_opponent_card_costs_more` (value=N) — Opponent's next card costs N more

## Available Triggers

| Trigger | When it fires |
|---------|--------------|
| `enter_battlefield` | When this card enters play |
| `on_cast` | When this card is cast (Spells, Instants, Decrees) |
| `attacks` | When this champion attacks |
| `dies` | When this champion dies |
| `on_ally_dies` | When an ally champion dies |
| `on_enemy_dies` | When an enemy champion dies |
| `on_gain_life` | When you gain life |
| `end_of_turn` | At end of your turn |
| `untap` | During untap step |
| `ON_COMBAT_DAMAGE` | When your champion deals combat damage |
| `ON_OPPONENT_SPELL` | When opponent casts a spell |
| `ON_ALLY_DIES` | When an ally dies |
| `on_reveal` | When you reveal a card |
| `on_discard` | When you discard |
| `on_draw` | When you draw |
| `on_champion_played` | When you play a Champion |
| `on_decree_played` | When you play a Decree |
| `on_second_card_played` | When you play your 2nd card this turn |
| `on_sacrifice` | When you sacrifice a champion |
| `on_enemy_attack` | When an enemy champion attacks |
| `static` | Continuous (always active) |
| `tap` | When tapped (activated ability) |
| `paid_mana` | When you pay mana (activated ability) |

## Available Keywords (string abilities)
Swiftstrike, Quickdraw, Keen Eye, Overrun, Deathshroud, Siphon, Flying, Intimidate, Guard, Bastion, Recall N, Ominous

## Omen Flip Triggers
`END_OF_TURN`, `ON_COMBAT_DAMAGE`, `ON_OPPONENT_SPELL`, `ON_ALLY_DIES`, `START_OF_TURN`

## Valid Relic/Enchantment triggers (static caveat)
`static` only works for continuous auras: `pump_all_champions`, `buff_all_allies`, `drain_heal_extra`, `extra_land_per_turn`, `buff_ally_toughness`. Everything else needs a real trigger (`end_of_turn`, `on_champion_played`, `on_gain_life`, `attacks`, `dies`, etc.). Activated abilities use `tap` or `paid_mana` with `activationCost`.

## Your Task

Output all 73 cards in a single JSON array. For each card provide the exact `id`, a thematic `name` (your choice for 509-581), correct `type`, `color: "Zealot"`, `providesMana` (null for non-lands, 1 for lands), valid `rarity`, and a properly structured `abilities` array (strings for keywords, objects for triggered effects). For Omens include `flipTrigger` + `faceDownCost`. For Recall champs include `recallCharges: N`. Give legendary-flavored champions multiple abilities.

### Zealot design themes to explore:
- **Lifegain synergy**: `on_gain_life` triggers (buff self, create tokens, draw cards)
- **Combat momentum**: `attacks` triggers (pump, damage, draw), `ON_COMBAT_DAMAGE` triggers
- **Righteous fury**: stronger as combat goes on, rewards aggressive attacks
- **Ally support**: `buff_all_allies`, `buff_ally_toughness`, `ready_champion`, `grant_swiftstrike_ally`
- **Divine protection**: `Guard`, `reduce_combat_damage_all`, `destroy_omen` (purge hidden threats)
- **Holy damage**: `damage_any_target`, `damage_random_enemy`, `each_player_lose_1`
- **Zealot signature keywords**: `Swiftstrike` (aggression), `Guard` (devotion), `Siphon` (lifegain)

### Card count checklist — verify before outputting:
- [ ] 509-519: 11 Champions
- [ ] 520-529: 10 Relics
- [ ] 530-538: 9 Spells
- [ ] 539-547: 9 Instants
- [ ] 548-552: 5 Decrees
- [ ] 553-554: 2 Omens
- [ ] 555: 1 Domain
- [ ] 556-575: 20 Lands
- [ ] 576-581: 6 Champions
- [ ] Total: 73 cards, every id 509-581 present exactly once, `color: "Zealot"`
- [ ] Do NOT include ids 485-501 or 503-508 (hero cards already exist — id 502 is NOT used)
