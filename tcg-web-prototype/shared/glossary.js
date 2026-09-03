/*
 * glossary.js — HOVER GLOSSARY (learn layer)
 * =========================================
 * UMD module (browser global GLOSSARY / Node require). Merges KEYWORDS.DEFS
 * with mechanic + ruleset terms so card rules text, footnotes, and (later)
 * the deck builder all tooltip from one term bank.
 *
 * Rule: every definition must describe actual engine behavior. If the engine
 * changes, update the def here in the same commit.
 */
(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(typeof KEYWORDS !== 'undefined' ? KEYWORDS : null);
  } else {
    root.GLOSSARY = factory(root.KEYWORDS || null);
  }
})(typeof self !== 'undefined' ? self : this, function(KEYWORDS) {

  // Mechanics + ruleset conditions (keywords themselves live in KEYWORDS.DEFS).
  var MECHANICS = {
    'Purge': 'Removed to the purge zone. Harsher than destroy — never touches the graveyard.',
    'Exile': 'Where Recall sends dying champions instead of the graveyard.',
    'Scry': 'Look at the top card(s) of your deck; put unwanted ones on the bottom.',
    'Drain': 'The opponent loses life and you gain that much life.',
    'Tap': 'Turn sideways to pay for an action. Tapped cards cannot attack or block.',
    'Untap': 'Ready a tapped card during untap, or by an effect.',
    'face-down': 'Hidden unit. Flips face-up when its trigger fires or its flip cost is paid.',
    'flip': 'Turn a face-down unit face-up and fire its ability.',
    'Stack': 'Spells and abilities wait here. Last in, first out.',
    'Priority': 'Your chance to answer with an Instant before the stack resolves.',
    'Mulligan': 'London-style: redraw one fewer card. The AI keeps 2-to-5-land hands.',
    'Once each turn': 'This limit resets at the start of every turn.',
    'Once per turn': 'This limit resets at the start of every turn.'
  };

  function terms() {
    var out = {};
    var k;
    if (KEYWORDS && KEYWORDS.DEFS) {
      for (k in KEYWORDS.DEFS) out[k] = KEYWORDS.DEFS[k];
    }
    for (k in MECHANICS) out[k] = MECHANICS[k];
    return out;
  }

  return {
    MECHANICS: MECHANICS,
    terms: terms
  };

});
