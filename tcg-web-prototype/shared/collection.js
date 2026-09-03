/*
 * collection.js — COLLECTION + SAVED DECKS (persistence seam)
 * ============================================================
 * UMD module (browser global COLLECTION / Node require). Owns all
 * persistence: versioned keys, starter grants, saved custom decks,
 * and the legality gate the builder and (later) the economy use.
 *
 * Keys: tcg.v1.collection ({id: ownedCount}), tcg.v1.decks ([defs]),
 * tcg.v1.cinders (soft-currency balance, economy phase), tcg.v1.schema.
 * ALPHA: full playset unlocked (4x every non-land, lands infinite).
 * Economy phases will gate grants/crafting behind Cinders; the gate
 * functions below already exist so no builder code changes then.
 */
(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.COLLECTION = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {

  var PREFIX = 'tcg.v1.';
  var SCHEMA = 1;
  var PLAYSET = 4;

  function memStore() {
    var data = {};
    return {
      getItem: function(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
      setItem: function(k, v) { data[k] = String(v); },
      removeItem: function(k) { delete data[k]; }
    };
  }

  function backend() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('__tcg_probe__', '1');
        localStorage.removeItem('__tcg_probe__');
        return localStorage;
      }
    } catch (e) { /* private mode etc — fall through */ }
    return memStore();
  }

  var store = backend();

  function read(key, fallback) {
    try {
      var raw = store.getItem(PREFIX + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    try { store.setItem(PREFIX + key, JSON.stringify(value)); }
    catch (e) { /* storage full/blocked — session continues in-memory */ }
  }

  // Schema marker + migration stub (v1: nothing to migrate yet).
  function migrate() {
    var v = read('schema', 0);
    if (v < SCHEMA) {
      write('schema', SCHEMA);
    }
    return read('schema', SCHEMA);
  }

  // ALPHA starter: 4x every non-land card. Lands are infinite, never stored.
  function ensureStarter(cardDB) {
    migrate();
    var col = read('collection', null);
    if (col) return col;
    col = {};
    cardDB.forEach(function(c) {
      if (c.type !== 'Land') col[c.id] = PLAYSET;
    });
    write('collection', col);
    return col;
  }

  function getCount(id) {
    var col = read('collection', {});
    return col[id] || 0;
  }

  function grant(id, n) {
    var col = read('collection', {});
    col[id] = Math.min(99, (col[id] || 0) + (n || 1));
    write('collection', col);
    return col[id];
  }

  // Lands are free and infinite; everything else needs owned >= count.
  function owns(card, count) {
    if (!card) return false;
    if (card.type === 'Land') return true;
    return getCount(card.id) >= (count || 1);
  }

  function ownsPlayset(entries, cardDB) {
    var byId = {};
    cardDB.forEach(function(c) { byId[c.id] = c; });
    for (var i = 0; i < entries.length; i++) {
      if (!owns(byId[entries[i].id], entries[i].count)) return false;
    }
    return true;
  }

  // --- saved decks ---------------------------------------------------------
  function listDecks(format) {
    var all = read('decks', []);
    if (format) all = all.filter(function(d) { return d.format === format; });
    return all;
  }

  function saveDeck(def) {
    var all = read('decks', []);
    var at = -1;
    for (var i = 0; i < all.length; i++) {
      if (all[i].name === def.name && all[i].format === def.format) { at = i; break; }
    }
    var record = { name: def.name, faction: def.faction, format: def.format, cards: def.cards };
    if (at >= 0) all[at] = record;
    else all.push(record);
    write('decks', all);
    return record;
  }

  function deleteDeck(name, format) {
    var all = read('decks', []);
    all = all.filter(function(d) { return !(d.name === name && d.format === format); });
    write('decks', all);
    return all;
  }

  // --- soft currency stub (economy phase wires earn/spend) -------------------
  function cinders() { return read('cinders', 0); }
  function addCinders(n) {
    var v = cinders() + (n || 0);
    write('cinders', v);
    return v;
  }

  return {
    PREFIX: PREFIX,
    SCHEMA: SCHEMA,
    PLAYSET: PLAYSET,
    migrate: migrate,
    ensureStarter: ensureStarter,
    getCount: getCount,
    grant: grant,
    owns: owns,
    ownsPlayset: ownsPlayset,
    listDecks: listDecks,
    saveDeck: saveDeck,
    deleteDeck: deleteDeck,
    cinders: cinders,
    addCinders: addCinders
  };

});
