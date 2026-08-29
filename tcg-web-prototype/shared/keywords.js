(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.KEYWORDS = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {

  var KEYWORD_DEFS = {
    Swiftstrike: 'Can attack the turn it enters.',
    Quickdraw: 'Deals damage before champions without Quickdraw.',
    Overrun: 'Excess combat damage carries over to the opponent.',
    Flying: 'Can only be blocked by champions with Flying or Reach.',
    Deathshroud: 'Any amount of damage dealt is lethal.',
    Siphon: 'Damage dealt also gains you that much life.',
    'Keen Eye': "Doesn't tap when attacking.",
    Intimidate: 'Can only be blocked by 2 or more champions.',
    Guard: 'Champion may block up to its toughness in opposing champions.',
    Bastion: 'Champion may block any number of opposing champions.',
    Recall: 'Exiles instead of dying. Pay 2x its cost to return it from exile to the battlefield.',
    Ominous: 'Played face-down as a hidden unit. Flips face-up at the end of your turn.'
  };

  var KEYWORD_MAP = {
    'swiftstrike': 'haste',
    'quickdraw': 'first_strike',
    'keen_eye': 'vigilance',
    'keen eye': 'vigilance',
    'overrun': 'trample',
    'deathshroud': 'deathtouch',
    'siphon': 'lifelink',
    'flying': 'flying',
    'intimidate': 'menace',
    'haste': 'haste',
    'trample': 'trample',
    'unblockable': 'unblockable',
    'first_strike': 'first_strike',
    'firststrike': 'first_strike',
    'double_strike': 'double_strike',
    'deathtouch': 'deathtouch',
    'lifelink': 'lifelink',
    'vigilance': 'vigilance',
    'menace': 'menace',
    'reach': 'reach',
    'indestructible': 'indestructible',
    'hexproof': 'hexproof',
    'flash': 'flash',
    'guard': 'guard',
    'bastion': 'bastion',
    'recall': 'recall',
    'ominous': 'ominous',
    'omnious': 'ominous'
  };

  function getKeywords(card) {
    var keywords = new Set();
    if (!card || !card.abilities) return keywords;

    for (var i = 0; i < card.abilities.length; i++) {
      var ability = card.abilities[i];
      if (typeof ability === 'string') {
        var normalized = ability.toLowerCase().replace(/ /g, '_');
        var display = ability.toLowerCase().replace(/_/g, ' ');
        var mapped = KEYWORD_MAP[normalized] || KEYWORD_MAP[display];
        if (mapped) keywords.add(mapped);
        if (/^recall/.test(display)) keywords.add('recall');
        if (display === 'ominous' || normalized === 'ominous') keywords.add('ominous');
      } else if (typeof ability === 'object' && ability.effect) {
        var mapped = KEYWORD_MAP[ability.effect];
        if (mapped) keywords.add(mapped);
      }
    }
    return keywords;
  }

  function championHasKeyword(champion, keyword) {
    return getKeywords(champion).has(keyword);
  }

  function playerHasKeyword(player, keyword) {
    if (!player || !player.battlefield) return false;
    for (var i = 0; i < player.battlefield.champions.length; i++) {
      if (championHasKeyword(player.battlefield.champions[i], keyword)) return true;
    }
    return false;
  }

  return {
    DEFS: KEYWORD_DEFS,
    MAP: KEYWORD_MAP,
    getKeywords: getKeywords,
    championHasKeyword: championHasKeyword,
    playerHasKeyword: playerHasKeyword
  };

});
