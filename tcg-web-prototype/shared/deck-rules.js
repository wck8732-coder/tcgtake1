/*
 * deck-rules.js — DECK VALIDITY (single source of truth)
 * ======================================================
 * UMD module (browser global DECKRULES / Node require). One rules module
 * used by the browser builder UI, the internal premade generator, and
 * (later) server-side validation. If a rule changes, change it here once.
 *
 * Deck shape: [{ id, count }] — the same entries stored in decks.json.
 * Rules: total 70, lands 24, non-land 46, 1..4 copies per card,
 * every id resolves in the card DB, format is known.
 */
(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.DECKRULES = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {

  var TOTAL = 70, LANDS = 24, NONLAND = 46, MAXCOPIES = 4;
  var FORMATS = ['Classic', 'Standard'];

  function manaValue(card) {
    if (!card || card.cost == null) return 0;
    if (typeof card.cost === 'number') return card.cost;
    return (card.cost.generic || 0) + (card.cost.color ? 1 : 0);
  }

  function mapById(cardDB) {
    var m = new Map();
    cardDB.forEach(function(c) { m.set(c.id, c); });
    return m;
  }

  // Expand entries into a shuffled array of card clones (for sample hands).
  function expandDeck(entries, cardDB, shuffleFn) {
    var byId = mapById(cardDB);
    var out = [];
    entries.forEach(function(e) {
      var card = byId.get(e.id);
      if (!card) return;
      var n = Math.min(Math.max(1, e.count | 0), MAXCOPIES);
      for (var i = 0; i < n; i++) out.push(JSON.parse(JSON.stringify(card)));
    });
    var rnd = shuffleFn || Math.random;
    for (var j = out.length - 1; j > 0; j--) {
      var k = Math.floor(rnd() * (j + 1));
      var t = out[j]; out[j] = out[k]; out[k] = t;
    }
    return out;
  }

  function validateDeck(entries, cardDB, format) {
    var errors = [];
    var byId = mapById(cardDB);
    var total = 0, lands = 0;
    var curve = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, '6+': 0 };
    var factions = {};
    entries.forEach(function(e) {
      var card = byId.get(e.id);
      if (!card) { errors.push('Unknown card id ' + e.id); return; }
      if (!e.count || e.count < 1 || e.count > MAXCOPIES) {
        errors.push(card.name + ': copies must be 1–' + MAXCOPIES);
      }
      total += e.count;
      if (card.type === 'Land') { lands += e.count; return; }
      var mv = manaValue(card);
      var bucket = mv <= 1 ? 1 : mv >= 6 ? '6+' : mv;
      curve[bucket] += e.count;
      factions[card.color] = (factions[card.color] || 0) + e.count;
    });
    var nonLand = total - lands;
    if (FORMATS.indexOf(format) < 0) errors.push('Unknown format ' + format);
    if (total !== TOTAL) errors.push('Deck must be exactly ' + TOTAL + ' cards (now ' + total + ')');
    if (lands !== LANDS) errors.push('Deck must have exactly ' + LANDS + ' lands (now ' + lands + ')');
    if (nonLand !== NONLAND) errors.push('Deck must have exactly ' + NONLAND + ' non-land cards (now ' + nonLand + ')');
    return { ok: errors.length === 0, errors: errors, total: total, lands: lands, nonLand: nonLand, curve: curve, factions: factions };
  }

  // Majority non-land faction (for auto-lands). Falls back to `fallback`.
  function majorityFaction(entries, cardDB, fallback) {
    var byId = mapById(cardDB);
    var counts = {};
    entries.forEach(function(e) {
      var card = byId.get(e.id);
      if (card && card.type !== 'Land') counts[card.color] = (counts[card.color] || 0) + e.count;
    });
    var best = fallback || null, bestN = 0;
    Object.keys(counts).forEach(function(f) {
      if (counts[f] > bestN) { bestN = counts[f]; best = f; }
    });
    return best;
  }

  return {
    TOTAL: TOTAL,
    LANDS: LANDS,
    NONLAND: NONLAND,
    MAXCOPIES: MAXCOPIES,
    FORMATS: FORMATS,
    manaValue: manaValue,
    expandDeck: expandDeck,
    validateDeck: validateDeck,
    majorityFaction: majorityFaction
  };

});
