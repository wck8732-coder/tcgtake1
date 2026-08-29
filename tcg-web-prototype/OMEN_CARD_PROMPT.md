# OMEN CARD DESIGN PROMPT — for Gemini

You are a TCG card designer. Design **10 Omen cards** for the web prototype described below.
This is a DESIGN deliverable — do NOT write engine code. Output cards in the JSON/ability
format shown at the bottom so they can be dropped into `cards.json` later.

## The game (fast context)
- Web TCG, MTG-inspired. Factions: **Crimson** (red/aggro), **Sunforged** (white/defense),
  **Lantern** (black/control), **Gilded** (blue/tempo), **Colorless** (non-faction splash,
  "outlaws/rejects" lore). Mana = lands; standard cost is `{generic:N, color:M}` (one color
  pip + generic). Colorless + one color is the norm — keep costs mono or colorless.
- Card types: Champion, Spell, Instant, Decree, Relic, **Domain**, **Omen**, Land.
- Omens are played **face-down** as hidden 2/2 units (cost paid normally), then **flip
  face-up when a game event triggers them** (`ON_COMBAT_DAMAGE`, `ON_OPPONENT_SPELL`,
  `ON_ALLY_DIES`, `START_OF_TURN`, `END_OF_TURN`), or at the owner's end step.
- A flipped Omen that is a **Champion** becomes a real battlefield creature: it can attack
  the same turn it flips **only if it was played on an earlier turn** (played-from-hand +
  flipped same turn = summoning sickness). Champion-omens should have a **flip cost** that
  synergizes with the card's faction/theme.
- Non-Champion Omens (instant/effect type) resolve their flip ability and are done.

## The design brief — READ CAREFULLY
1. **Quirky, creative, 90s Yu-Gi-Oh animated-series energy.** Effects should be
   *flavorful and a little unpredictable* — traps, surprises, theatrics. NOT boring
   "deal N damage" or "draw a card." Think: "when this flips, swap something", "when your
   champion dies, this takes its place", "the opponent chooses — but either way is bad for
   them".
2. **Some must be "wild cards."** 2-3 of the 10 should have effects/mechanics/attributes
   that are clearly different from any other card type — unusual, game-defining *potential*
   — but NOT game-breaking. They should reward clever use and create memorable moments.
3. **Rarity scales with game-changing potential.** A card's rarity must match how much it
   can bend the game. Don't put a format-defining effect at Common. Common = small
   surprises; Uncommon = meaningful tricks; Rare = build-around; Mythic = centerpiece
   (1-2 max per 10).
4. **No "attack/kill/repeat."** Power must come from interesting interactions, not raw
   stats. Champions get modest P/T; their VALUE is in what they do when they flip.
5. **Faction identity must show.** Each colored card should feel like its faction:
   Crimson=aggression/pyro, Sunforged=protection/purify, Lantern=death/control,
   Gilded=tempo/artifice. 2 cards per colored faction (8 total) + 2 Colorless.
6. **Champion-omen flip costs must synergize** with the card's theme AND faction. E.g. a
   Lantern champion-omen might flip by *sacrificing a champion*, a Crimson one by *dealing
   damage to yourself*, a Sunforged one by *gaining life* — flavor AND cost woven together.
7. **Keep it engine-compatible.** Use the ability effects and triggers listed below. If you
   MUST invent a new effect, mark it `(NEW_EFFECT)` and describe exactly what it should do
   in 1 sentence. Do not invent new zones or new core rules.

## Deliverable format (one block per card, JSON-ish)

```json
{
  "id": 0, "name": "Card Name", "type": "Omen",
  "cost": { "generic": 2, "crimson": 1 },
  "power": null, "toughness": null, "color": "Crimson", "rarity": "Uncommon",
  "flipTrigger": "ON_COMBAT_DAMAGE",
  "flipCost": null,
  "faceDownPower": 2, "faceDownToughness": 2,
  "abilities": [
    { "name": "Name", "trigger": "ON_COMBAT_DAMAGE", "effect": "effect_name", "value": 1 }
  ],
  "flavor": "One line of 90s-anime-style flavor text."
}
```

For Champion-omens also set: `"type": "Omen"`, `"power": N, "toughness": N`, and give the
flip trigger + `flipCost` (see #6). The `abilities[0]` on a champion-omen is the
enter-the-battlefield / flip effect.

## Available ability effects (existing engine)
damage_any_target, damage_all_enemies, damage_random_enemy, damage_two_targets,
damage_all_champions, drain_life, drain_all_opponents, create_token, destroy_weakest_enemy,
destroy_all_enemies, destroy_all, destroy_relic, bounce_champion, bounce_enemies,
bounce_all_enemies, bounce_relic, bounce_two_enemies, draw_cards, return_from_graveyard,
tap_enemy_champion, sacrifice_then_damage, ramp_search_land, ramp_extra_land,
purge_target, purge_weakest, purge_all_enemies, purge_hidden, purge_from_graveyard,
purge_relic, reveal_card, reveal_top_deck, reveal_hidden, scry_1/2/3, draw_then_discard,
draw_two_discard_one, discard_opponent, draw_then_discard_gain_life, ready_champion,
ready_two_champions, ready_all_champions, next_card_costs_less, next_two_cards_cost_less,
next_opponent_card_costs_more, destroy_domain, destroy_omen, return_from_exile,
reveal_and_buff, opponent_chooses_purge, etc. (if you invent: mark `(NEW_EFFECT)`)

## Available flip triggers
ON_COMBAT_DAMAGE (your champion damaged / deals damage), ON_OPPONENT_SPELL (opponent casts
a spell), ON_ALLY_DIES (a friendly champion dies), START_OF_TURN, END_OF_TURN.

## Output
10 cards: 2 Crimson, 2 Sunforged, 2 Lantern, 2 Gilded, 2 Colorless.
Mix rarities appropriately (aim ~4 Common / 3 Uncommon / 2 Rare / 1 Mythic).
At least 2 must be Champion-omens with themed flip costs. At least 2 must be "wild cards"
(marked `"wildcard": true`). For every card, one-line flavor. Number them 1-10 with a 1-line
design note explaining WHY each is quirky and how a smart player could break the game
*in their favor*.
