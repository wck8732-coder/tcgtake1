# 120-Card Integration Plan

## CSV → Engine Mapping

### Faction Mapping
| CSV Faction | Engine Color |
|---|---|
| Crimson Thrones | Crimson |
| Lantern Covenant | Lantern |
| Sunforged Dominion | Sunforged |
| Gilded Axiom | Gilded |
| Neutral | Colorless |

### Rarity Mapping
| CSV Rarity | Engine Rarity |
|---|---|
| Common | Common |
| Uncommon | Uncommon |
| Rare | Rare |
| Renowned | Legendary |

### Type Mapping
| CSV Type | Engine Type |
|---|---|
| Champion | Champion |
| Decree | Decree |
| Relic | Relic |
| Omen | Omen |
| Domain | Domain |
| Instant | Instant (not in CSV) |
| Spell | Spell (not in CSV) |

### Keyword Mapping
| CSV Keyword | Engine Keyword | Notes |
|---|---|---|
| Drain | Siphon | CSV "Drain" = lifelink on combat damage |
| Guard | Guard | Identical |
| Recall 1 | Recall 1 | CSV uses "Recall X" where X=1 |
| Omen | Ominous | CSV "Omen" type = face-down card, different from engine "Ominous" keyword |

## Engine Effects Already Covered (from CSV)
Only 2 CSV rules_text entries map directly to existing engine effects:
- `draw_then_discard_gain_life` — "Draw a card, then discard a card. If the discarded card costs 4+ more, gain 1 life."
- `next_two_cards_cost_less` — "The next two cards you play this turn each cost 1 less."

## New Effects Required (112 unique)
All effects below are in CSV rules_text but NOT in the existing engine. They must be implemented in `shared/effects.js`, `game.js`, and `simulate.js`.

### Categories

#### 1. Ally-Death Triggers (8 cards)
- `each_player_lose_1_on_death` — When this dies, each player loses 1 life.
- `die_draw_discard` — When this dies, draw a card, then discard a card.
- `dies_create_token` — When this dies, create a 1/1 Thrall. (exists as create_token, needs death trigger)
- `dies_create_mercenary` — When this dies, create a 1/1 Mercenary.
- `revealed_enemy_dies_create_token` — When a revealed enemy unit dies, create a 1/1 Hunter.
- `champions_pump_dies_create_token` — Your attacking Champions gain +1 attack. If one dies, create a 1/1 Recruit.
- `first_ally_death_return_hand` — The first ally that dies each turn returns to your hand at end of turn.
- `once_per_turn_sacrifice_create_token` — Once each turn, when you sacrifice an ally, create a 2/2 Revenant.
- `once_per_turn_sacrifice_life_draw` — Once each turn, when you sacrifice an ally, gain 1 life and draw a card.

#### 2. Gain-Life Triggers (8 cards)
- `on_gain_life_pump_self` — When you gain life, this gets +1 attack this turn / +1/+1 this turn.
- `on_gain_life_leader_lose_life` — Whenever you gain life, the enemy leader loses 1 life.
- `on_gain_life_create_token` — When you gain life, create a 1/1 Recruit.
- `first_gain_life_draw` — The first time you gain life each turn, draw a card.
- `drain_heal_extra` — Your Drain effects heal 1 extra. (static)
- `drain_static_buff_allies` — Drain. Other allies with Drain get +1 attack. (keyword + static)
- `on_gain_life_or_draw_create_token` — When you gain life or draw a card outside draw step, create a Coin token.
- `once_per_turn_gain_life_draw_if_not_drawn` — Once each turn, when you gain life, draw a card if you haven't drawn this turn.

#### 3. Reveal Triggers (8 cards)
- `enters_reveal_hand` — When this enters play, reveal a card in your hand.
- `reveal_hidden_draw_if_omen` — Reveal a hidden card. If it is an Omen, draw a card.
- `once_per_turn_reveal_gain_life` — Once each turn, when you reveal a card, gain 1 life.
- `on_reveal_pump_self` — When you reveal a card, this gets +1 attack this turn.
- `on_reveal_heal_leader` — When you reveal a card, heal your leader 1 life.
- `once_per_turn_reveal_draw` — Once each turn, when you reveal a card, draw a card.
- `once_per_turn_reveal_scry` — Once each turn, when you reveal a card, scry 1.
- `once_per_turn_reveal_decree_cost_reduction` — Once each turn, when you reveal a card, your next Decree costs 1 less.
- `reveal_all_damage_hidden` — Reveal all hidden cards. Deal 2 damage to a hidden enemy unit.
- `on_reveal_heal_leader` — covered above.

#### 4. Attack Triggers (11 cards)
- `attacks_target_enemy_damage_1` — When this attacks, target enemy unit gets -1 life this turn.
- `attacks_revealed_draw` — When this attacks a revealed unit, draw a card.
- `attacks_with_allies_pump` — When this attacks with another ally, it gets +1 attack this turn.
- `attacks_if_another_champion_draw` — When this attacks, if you control another Champion, draw a card.
- `attacks_with_champion_draw` — When this attacks with another Champion, draw a card.
- `attacks_alone_pump_self_2` — When this attacks alone, it gets +2 attack this turn.
- `attacks_another_champion_pump` — When this attacks, another Champion you control gains +1/+1 this turn.
- `attacks_optional_pay_pump` — When this attacks, you may pay 1 to give it +1 attack this turn.
- `guard_attacks_pump_another` — Guard. When this attacks, another ally gets +1 attack this turn.
- `guard_attacks_ready_another` — Guard. When this attacks, ready another Champion.
- `guard_attacks_destroy_hidden` — Guard. When this attacks a hidden unit, destroy it.

#### 5. Enter-Battlefield / Play Triggers (12 cards)
- `enters_reveal_hand` — covered above.
- `enters_return_2cost_from_graveyard` — When this is played, return a 2-cost ally from your discard to your hand.
- `enters_next_champion_life` — When this enters play, the next Champion you play this turn gets +1 life.
- `enters_peek_top` — When this enters play, look at the top card of your deck.
- `enters_discard_draw_two_if` — When this enters play, you may discard a card. If you do, draw 2 cards.
- `enters_choose_cost_reduction` — When this enters play, choose a card in your hand. It costs 1 less this turn.
- `enters_return_decree_from_graveyard` — When this enters play, return a Decree from your discard to your hand.
- `enters_reveal_neutral` — When this enters play, you may reveal a neutral card from your hand.
- `enters_choose_faction_pump` — When this enters play, choose a faction. It gets +1 attack while you control a card of that faction.
- `enters_ally_dies` patterns (covered in ally-death triggers)

#### 6. Discard Triggers (2 cards)
- `on_discard_scry` — Once each turn, when you discard a card, scry 1.
- `first_discard_cost_reduction` — Once each turn, the first card you discard costs 1 less to play this turn if returned.

#### 7. Card-Play Triggers (6 cards)
- `on_decree_played_gain_life` — When you play a Decree, this gets +1 life this turn.
- `on_decree_played_pump` — When you play a Decree, this gets +1 attack this turn.
- `once_per_turn_decree_draw_discard` — Once each turn, when you play a Decree, draw a card then discard a card.
- `on_champion_played_gain_life` — Once each turn, when you play a Champion, gain 1 life.
- `on_second_card_played_pump` — When you play your second card each turn, this gets +1/+1.
- `on_second_card_played_draw` — Once each turn, after you play your second card, draw a card.
- `on_draw_decree_cost_reduction` — Once each turn, when you draw a card, your next Decree costs 1 less. (requires on_draw trigger)
- `on_second_draw_scry` — Once each turn, after you draw your second card, scry 1.
- `on_non_draw_step_gain_life` — Once each turn, when you draw a card outside your draw step, gain 1 life.
- `on_non_draw_step_pump` — When you draw a card outside your draw step, this gets +1 attack this turn.
- `on_neutral_played_gain_life` — Once each turn, when you play a neutral card, gain 1 life.
- `on_neutral_played_draw` — Once each turn, after you play a neutral card, draw a card.
- `first_champion_per_turn_attack` — The first Champion you play each turn gets +1 attack.
- `first_champion_per_turn_pump` — Once each turn, the first Champion you play gets +1/+0.
- `once_per_turn_champion_attack_pump` — Once each turn, when a Champion attacks, it gets +1 attack.
- `once_per_turn_champion_attack_damage_leader` — Once each turn, when a Champion attacks, deal 1 damage to the enemy leader.
- `once_per_turn_champion_attack_gain_life` — Once each turn, when a Champion attacks, gain 1 life.
- `once_per_turn_champion_grant_guard` — Once each turn, when you play a Champion, it gains Guard until your next turn.
- `once_per_turn_3plus_attack_create_token` — Once each turn, when you attack with three or more allies, create a 2/2 Recruit.
- `on_gain_life_create_token` — covered above.

#### 8. Static / Aura Effects (7 cards)
- `cheap_allies_get_life` — Allies you play with cost 1 or less get +1 life. (static)
- `drain_heal_extra` — covered above.
- `drain_static_buff_allies` — covered above.
- `first_champion_per_turn_pump` — covered above.
- `first_purge_cost_reduction` — Your first purge each turn costs 1 less. (static, requires purge tracking)
- `other_champions_pump_on_attack` — Other allied Champions get +1 attack when they attack. (static)
- `once_per_turn_champion_attack_pump` — covered above.

#### 9. Targeted Effects (6 cards)
- `damage_gain_life` — Deal 1 damage to a unit. Gain 1 life. (exists as drain_life with value, but text differs)
- `drain_2_draw_if_unit_died` — Drain 2. If a unit died this turn, draw a card. (conditional drain+draw)
- `target_neg_draw_if_damaged` — Target unit gets -1 attack this turn. Draw a card if it was already damaged.
- `target_neg_2_damage_if_damaged` — Target unit gets -2 attack. If it was damaged, it also gets -1 life.
- `give_life_draw_if_champion` — Give an ally +1 life. Draw a card if it is a Champion.
- `pump_target_draw_if_attacked` — An ally gets +1 attack this turn. If it attacked, draw a card.

#### 10. Bounce Effects (4 cards)
- `bounce_cost_2_or_less` — Return a unit with cost 2 or less to its owner's hand.
- `bounce_champion_discard` — Return a champion to hand. Its controller discards a card.
- `bounce_draw_card` — Return a unit to its owner's hand. Draw a card.
- `champions_pump_dies_create_token` — covered above.

#### 11. Conditional / Choice Effects (4 cards)
- `purge_create_token_if_success` — Purge a curse. If you do, create a 1/1 Witness.
- `omen_draw_gain_life_if_neutral` — Omen — Draw a card. If it is neutral, gain 1 life.
- `omen_choice_draw_or_damage` — Omen — Choose one: draw a card or deal 2 damage to a unit.
- `once_per_turn_gain_life_draw_if_not_drawn` — covered above.

#### 12. Omen Effects (6 cards)
- `omen_ally_dies_damage_leader` — Omen — When an ally dies, deal 2 damage to the enemy leader.
- `omen_return_ally_if_died` — Omen — At end of your turn, if an ally died this turn, return that ally to play with 1 life.
- `omen_prevent_damage` — Omen — Prevent the next 2 damage that would be dealt to an ally.
- `omen_enemy_attack_purge` — Omen — When an enemy unit attacks, purge it at end of combat.
- `omen_3plus_attack_create_token` — Omen — When three or more allies attack, create a 3/3 Sunguard.
- `omen_double_decree_trigger` — Omen — The next Decree you play this turn triggers twice.
- `omen_opponent_card_cost_more_2` — Omen — The next card your opponent plays costs 2 more.
- `omen_next_card_cost_less` — Omen — The next card you play costs 1 less.

## New Triggers Required
The engine currently has these triggers: `enter_battlefield`, `on_cast`, `attacks`, `dies`, `on_ally_dies`, `on_gain_life`, `untap`, `end_of_turn`, `ON_COMBAT_DAMAGE`, `ON_OPPONENT_SPELL`

New triggers needed:
1. `on_reveal` — triggers when a card is revealed
2. `on_discard` — triggers when a card is discarded
3. `on_draw` — triggers when a card is drawn
4. `on_champion_played` — triggers when a Champion is played
5. `on_decree_played` — triggers when a Decree is played
6. `on_second_card_played` — triggers on second card played each turn
7. `on_non_draw_step` — triggers when drawn outside draw step
8. `on_sacrifice` — triggers when a champion is sacrificed
9. `on_enemy_attack` — triggers when enemy attacks

## New Keywords
1. `Drain` (CSV) → maps to `Siphon`/`drain_life` in engine but CSV's meaning is "when this deals combat damage, gain that much life" — needs a keyword-level implementation
2. `Recall 1` (CSV) → already exists in engine but CSV uses it as string keyword (not the "Recall N" engine format)

## Card Count Analysis
CSV cards by type:
- Champion: 54 cards
- Decree: 35 cards
- Relic: 17 cards
- Omen: 11 cards
- Domain: 16 cards
- Total: 120 cards

Engine cards (cards_full.json) by type:
- Land: 24 cards
- Champion: ~170 cards
- Spell: ~30 cards
- Instant: ~20 cards
- Decree: ~20 cards
- Relic: ~20 cards
- Domain: ~10 cards
- Omen: ~10 cards
- Total: 364 cards

CSV factions each have 24 cards (CT01-24, LC01-24, SD01-24, GA01-24) + 24 Neutral (N01-24).
