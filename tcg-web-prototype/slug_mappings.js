/*
 * slug_mappings.js - DECK SLUG MAPPINGS (strict module)
 * ======================================================
 * Single source of truth for deck slugs, faction->slug pairs, and strategy
 * blurbs. Consumed by gen_decks.js (deck generator), game.js (deck picker),
 * and simulate.js (stats labeling). Shared via script tag (global SLUGS) or
 * require(). Deck slug keys must match decks.json.
 */
(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.SLUGS = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {

  const COLORS = ['Crimson', 'Sunforged', 'Lantern', 'Gilded', 'Colorless', 'Zealot'];

  // Faction -> deck slug (matches decks.json keys)
  const DECK_SLUGS = {
    Crimson: 'volcano_inferno_aggro',
    Sunforged: 'forest_verdant_stompy',
    Lantern: 'swamp_death_decay',
    Gilded: 'ocean_tidal_control',
    Colorless: 'artifact_neutral_midrange',
    Zealot: 'zealot_holy_inquisition'
  };

  // Both Classic and Standard now permit four copies of every card (no rarity caps).
  const FORMATS = {
    Classic: { key: 'Classic', maxCopies: 4, rarityCaps: null },
    Standard: { key: 'Standard', maxCopies: 4, rarityCaps: null }
  };
  const FORMAT_KEYS = Object.keys(FORMATS);

  // Faction -> strategy blurb (displayed in deck picker)
  const STRATEGY = {
    Crimson: 'Ultra-aggressive burn. Flood board with cheap creatures, finish with direct damage.',
    Sunforged: 'Stompy ramp and overrun. Big creatures and token swarms.',
    Lantern: 'Death and decay. Sacrifice value, drain life, recursive threats.',
    Gilded: 'Control and card draw. Bounce, counters, outcard opponents.',
    Colorless: 'Neutral/artifact splash. Efficient colorless threats and utility for any deck.',
    Zealot: 'Anti-heresy. Buffs, lifegain, and purge the unworthy.'
  };

  function factionToSlug(faction) { return DECK_SLUGS[faction] || null; }
  function slugToFaction(slug) {
    for (const f in DECK_SLUGS) { if (DECK_SLUGS[f] === slug) return f; }
    return null;
  }
  function getStrategy(faction) { return STRATEGY[faction] || ''; }
  function maxCopiesFor(format, rarity) {
    const definition = FORMATS[format];
    if (!definition) return 4;
    return definition.rarityCaps && definition.rarityCaps[rarity] != null
      ? definition.rarityCaps[rarity]
      : definition.maxCopies;
  }

  return {
    COLORS: COLORS,
    DECK_SLUGS: DECK_SLUGS,
    FACTION_SLUGS: DECK_SLUGS,
    STRATEGY: STRATEGY,
    FORMATS: FORMATS,
    FORMAT_KEYS: FORMAT_KEYS,
    maxCopiesFor: maxCopiesFor,
    factionToSlug: factionToSlug,
    slugToFaction: slugToFaction,
    getStrategy: getStrategy
  };
});
