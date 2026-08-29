(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.FACTIONS = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {

  var COLOR_HEX = {
    Crimson: '#c0392b',
    Sunforged: '#27ae60',
    Lantern: '#000000',
    Gilded: '#2980b9',
    Zealot: '#f1c40f',
    Colorless: '#95a5a6'
  };

  var FACTION_FROM_CSV = {
    'Crimson Thrones': 'Crimson',
    'Lantern Covenant': 'Lantern',
    'Sunforged Dominion': 'Sunforged',
    'Gilded Axiom': 'Gilded',
    'Neutral': 'Colorless'
  };

  var CSV_RARITY_MAP = {
    'Common': 'Common',
    'Uncommon': 'Uncommon',
    'Rare': 'Rare',
    'Renowned': 'Legendary',
    'Mythic': 'Mythic'
  };

  var CSV_TYPE_MAP = {
    'Champion': 'Champion',
    'Decree': 'Decree',
    'Omen': 'Omen',
    'Domain': 'Domain',
    'Relic': 'Relic'
  };

  var CSV_KEYWORD_MAP = {
    'Drain': 'Siphon',
    'Guard': 'Guard',
    'Recall 1': 'Recall 1',
    'Recall X': 'Recall X'
  };

  var COLOR_HEX_DECK = {
    Crimson: '#c0392b',
    Sunforged: '#27ae60',
    Lantern: '#8e44ad',
    Gilded: '#2980b9',
    Zealot: '#f1c40f',
    Colorless: '#95a5a6'
  };

  return {
    HEX: COLOR_HEX,
    HEX_DECK: COLOR_HEX_DECK,
    FROM_CSV: FACTION_FROM_CSV,
    RARITY_MAP: CSV_RARITY_MAP,
    TYPE_MAP: CSV_TYPE_MAP,
    KEYWORD_MAP: CSV_KEYWORD_MAP
  };

});
