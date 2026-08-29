(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.EFFECTS = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {

  // String abilities that carry an engine effect id (display-only mapping).
  var STRING_EFFECTS = {
    destroy_enchantment: 'Destroy target enchantment.',
    bounce_enchantment: 'Return target enchantment to your hand.'
  };

  function describeAbility(a) {
    if (typeof a === 'string') return STRING_EFFECTS[a] || a.replace(/_/g, ' ');
    var e = a.effect;
    var v = a.value;
    var vv = v || 1;
    var one = vv === 1;
    var cardsWord = one ? 'a card' : vv + ' cards';
    var championWord = one ? 'an enemy champion' : vv + ' enemy champions';
    var ownChampionWord = one ? 'one of their own champions' : vv + ' of their own champions';
    var trigger = a.trigger === 'on_cast' ? '' :
                  a.trigger === 'enter_battlefield' ? 'When this enters: ' :
                  a.trigger === 'end_of_turn' ? 'At end of turn: ' :
                  a.trigger === 'attacks' ? 'When attacking: ' :
                  a.trigger === 'static' ? '' :
                  a.trigger === 'dies' ? 'When this dies: ' :
                  a.trigger === 'on_ally_dies' ? 'When an ally dies: ' :
                  a.trigger === 'on_gain_life' ? 'When you gain life: ' :
                  a.trigger === 'on_reveal' ? 'When you reveal: ' :
                  a.trigger === 'on_discard' ? 'When you discard: ' :
                  a.trigger === 'on_draw' ? 'When you draw: ' :
                  a.trigger === 'on_champion_played' ? 'When you play a Champion: ' :
                  a.trigger === 'on_decree_played' ? 'When you play a Decree: ' :
                  a.trigger === 'on_second_card_played' ? 'When you play your second card: ' :
                  a.trigger === 'ON_COMBAT_DAMAGE' ? 'On combat damage: ' :
                  a.trigger === 'ON_OPPONENT_SPELL' ? 'When opponent casts: ' :
                  a.trigger === 'ON_ALLY_DIES' ? 'When an ally dies: ' :
                  a.trigger === 'on_enemy_attack' ? 'When enemy attacks: ' :
                  '';

    var descriptions = {
      damage_all_enemies: 'Deal ' + (v || 1) + ' damage to all enemy champions.',
      damage_any_target: 'Deal ' + (v || 1) + ' damage to any target.',
      damage_random_enemy: 'Deal ' + (v || 1) + ' damage to a random enemy.',
      damage_two_targets: 'Deal ' + (v || 1) + ' damage to two targets.',
      damage_all_champions: 'Deal ' + (v || 1) + ' damage to ALL champions.',
      damage_relic: 'Deal ' + (v || 1) + ' damage to target relic.',
      create_token: one ? 'Create a ' + (a.tokenPower || 1) + '/' + (a.tokenToughness || 1) + ' ' + (a.tokenName || 'Token') + '.' : 'Create ' + v + ' ' + (a.tokenPower || 1) + '/' + (a.tokenToughness || 1) + ' ' + (a.tokenName || 'Token') + 's.',
      destroy_all_enemies: 'Destroy all enemy champions.',
      destroy_weakest_enemy: 'Destroy the weakest enemy champion.',
      destroy_relic: 'Destroy target relic.',
      destroy_omen: 'Destroy target hidden (face-down) card.',
      destroy_all: 'Destroy all champions.',
      bounce_enemies: one ? 'Return an enemy champion to hand.' : 'Return ' + v + ' enemy champions to hand.',
      bounce_all_enemies: 'Return all enemy champions to hand.',
      bounce_two_enemies: 'Return two enemy champions to hand.',
      bounce_relic: 'Return target relic to hand.',
      bounce_champion: 'Return target champion to hand.',
      draw_cards: one ? 'Draw a card.' : 'Draw ' + v + ' cards.',
      return_from_graveyard: one ? 'Return a card from your graveyard to your hand.' : 'Return ' + v + ' cards from your graveyard to your hand.',
      return_from_exile: one ? 'Return a champion from exile to your hand.' : 'Return ' + v + ' champions from exile to your hand.',
      swap_champion: 'Swap control of target enemy champion and a friendly champion.',
      opponent_chooses_purge: 'Opponent purges ' + ownChampionWord + '.',
      reduce_combat_damage_all: 'All combat damage to your side is reduced by ' + (v || 1) + ' this turn.',
      invert_stats_all: "Invert all champions' power and toughness this turn.",
      grant_swiftstrike_ally: 'Target ally gains Swiftstrike until end of turn.',
      buff_crimson_attack: 'Your Crimson champions get +' + v + ' attack.',
      buff_ally_toughness: 'Your other champions get +' + v + ' toughness.',
      buff_all_allies: 'All your champions get +' + v + '/+' + v + '.',
      recall_cost_less: 'Your Recall costs ' + v + ' less.',
      double_fire_damage: 'Your Crimson champions deal double combat damage.',
      purge_target: 'Purge target enemy champion.',
      purge_weakest: 'Purge the weakest enemy champion.',
      purge_all_enemies: 'Purge all enemy champions.',
      purge_hidden: 'Purge a hidden enemy unit.',
      purge_from_graveyard: 'Purge a card from target graveyard.',
      purge_relic: 'Purge target relic.',
      reveal_card: 'Reveal a card from your hand.',
      reveal_top_deck: 'Reveal the top card of your deck.',
      reveal_hidden: 'Reveal all hidden enemy cards.',
      scry_1: 'Scry 1.',
      scry_2: 'Scry 2.',
      scry_3: 'Scry 3.',
      draw_then_discard: 'Draw a card, then discard a card.',
      draw_two_discard_one: 'Draw two cards, then discard one.',
      discard_opponent: one ? 'Opponent discards a card.' : 'Opponent discards ' + v + ' cards.',
      draw_then_discard_gain_life: 'Draw a card, then discard a card. If the discarded card costs ' + (v || 4) + ' or more, gain 1 life.',
      ready_champion: 'Ready target friendly champion.',
      ready_two_champions: 'Ready up to two friendly champions.',
      ready_all_champions: 'Ready all friendly champions.',
      next_card_costs_less: 'The next card you play this turn costs ' + v + ' less.',
      next_two_cards_cost_less: 'The next two cards you play this turn each cost ' + v + ' less.',
      next_opponent_card_costs_more: 'The next card your opponent plays this turn costs ' + v + ' more.',
      damage_hidden: 'Deal ' + (v || 1) + ' damage to a hidden enemy unit.',
      ramp_search_land: 'Search your deck for a basic land and put it into play.',
      ramp_extra_land: 'You may play an additional land this turn.',
      drain_life: 'Deal ' + (v || 1) + ' damage. Gain that much life.',
      drain_all_opponents: 'Drain ' + (v || 1) + ' from each opponent.',
      tap_enemy_champion: 'Tap target enemy champion.',
      sacrifice_then_damage: 'Sacrifice a champion: deal ' + (v || 1) + ' damage.',
      sacrifice_then_draw: 'Sacrifice a champion: draw ' + (one ? 'a card' : v + ' cards') + '.',
      extra_land_per_turn: 'You may play an additional land each turn.',
       pump_all_champions: 'All your champions get +' + v + '/+' + v + ' this turn.',
      each_player_lose_1: 'Each player loses ' + (v || 1) + ' life.',
      drain_heal_extra: 'Your Drain effects heal ' + (v || 1) + ' extra.',
      first_ally_dies_return_hand: 'The first ally that dies each turn returns to your hand at end of turn.',
      omen_return_ally_with_1_life: 'At end of turn, if an ally died this turn, return that ally to play with 1 life.',
      stat_change_target: 'Target unit gets ' + (a.attackDelta || 0) + ' attack this turn.',
      first_purge_cost_less: 'Your first purge each turn costs ' + (v || 1) + ' less.',
      grant_guard_until_next_turn: 'Champions entering this turn gain Guard until your next turn.',
      gain_life: 'Gain ' + (v || 1) + ' life.',
      grant_guard_self_if_two_plus_attack: 'When attacking with two or more allies, this gains Guard until end of turn.',
      grant_guard_all_champions: 'Your champions gain Guard until end of turn.',
      next_decree_triggers_twice: 'The next Decree you play this turn triggers twice.',
      omen_draw_gain_life_if_neutral: 'Draw a card. If it is neutral, gain 1 life.',
      first_discard_cost_less: 'The first card you discard each turn costs ' + (v || 1) + ' less to play this turn.',
      omen_choice_draw_or_damage: 'Choose one: draw a card or deal ' + (v || 2) + ' damage to a unit.',
      choose_faction_conditional_attack: 'Choose a faction. This gets +' + (v || 1) + ' attack while you control a card of that faction.',
      haste: '', first_strike: '', vigilance: '', trample: '', deathtouch: '',
      lifelink: '', flying: '', menace: '', guard: ''
    };

    var desc = descriptions[e] || e.replace(/_/g, ' ');
    if (a.trigger === 'static') return desc;
    return trigger + desc;
  }

  return {
    describe: describeAbility
  };

});
