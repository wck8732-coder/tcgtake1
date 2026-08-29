(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.PHASES = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {

  var PHASE_LIST = ['untap', 'draw', 'main1', 'combat', 'main2', 'end'];

  var PHASE_WINDOWS = {
    'untap': ['untap'],
    'draw': ['draw'],
    'main1': ['main1', 'main2', 'end'],
    'combat': ['combat'],
    'main2': ['main2', 'end'],
    'end': ['end']
  };

  var TRIGGERS = {
    ENTER_BATTLEFIELD: 'enter_battlefield',
    ON_CAST: 'on_cast',
    ATTACKS: 'attacks',
    DIES: 'dies',
    ON_ALLY_DIES: 'on_ally_dies',
    ON_GAIN_LIFE: 'on_gain_life',
    UNTAP: 'untap',
    END_OF_TURN: 'end_of_turn',
    ON_COMBAT_DAMAGE: 'ON_COMBAT_DAMAGE',
    ON_OPPONENT_SPELL: 'ON_OPPONENT_SPELL',
    ON_REVEAL: 'on_reveal',
    ON_DISCARD: 'on_discard',
    ON_DRAW: 'on_draw',
    ON_CHAMPION_PLAYED: 'on_champion_played',
    ON_DECREE_PLAYED: 'on_decree_played',
    ON_SECOND_CARD_PLAYED: 'on_second_card_played',
    ON_NON_DRAW_STEP: 'on_non_draw_step',
    ON_SACRIFICE: 'on_sacrifice',
    ON_ENEMY_ATTACK: 'on_enemy_attack',
    ON_ENEMY_REVEAL: 'on_enemy_reveal'
  };

  function isAbilityAllowedInPhase(ability, currentPhase) {
    if (!ability.allowedPhase) return true;
    var allowed = PHASE_WINDOWS[currentPhase] || [currentPhase];
    return ability.allowedPhase.some(function(p) { return allowed.indexOf(p) !== -1; });
  }

  return {
    LIST: PHASE_LIST,
    WINDOWS: PHASE_WINDOWS,
    TRIGGERS: TRIGGERS,
    isAllowedInPhase: isAbilityAllowedInPhase
  };

});
