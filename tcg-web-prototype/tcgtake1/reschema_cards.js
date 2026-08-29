/*
 * Re-schema tcgtake1/mapped_cards.json
 * Replaces every ability with effect==="custom" using the structured mapping table below.
 * Deterministic — run with: node reschema_cards.js
 * Overwrites mapped_cards.json with the transformed array and prints a validation summary.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'mapped_cards.json');

// card id -> list of replacement abilities (in the same order as the customs appear in abilities[])
const TABLE = {
  1001: [{ effect: 'each_player_lose_1', value: 1 }],
  1012: [{ effect: 'drain_heal_extra', value: 1 }],
  1015: [{ effect: 'first_ally_dies_return_hand' }],
  1019: [{ effect: 'draw_cards', value: 1, condition: 'unit_died_this_turn' }],
  1021: [{ effect: 'omen_return_ally_with_1_life' }],
  1026: [{ effect: 'stat_change_target', attackDelta: -1, lifeDelta: null }],
  1027: [{ effect: 'draw_cards', value: 1, condition: 'revealed_was_omen' }],
  1034: [{ effect: 'first_purge_cost_less', value: 1 }],
  1035: [{ effect: 'draw_cards', value: 1, condition: 'revealed_cost_lte_2' }],
  1042: [{ effect: 'draw_cards', value: 2, condition: 'purged_was_hidden' }],
  1051: [{ effect: 'draw_cards', value: 1, condition: 'target_attacked_this_turn' }],
  1053: [{ effect: 'grant_guard_until_next_turn' }],
  1057: [{ effect: 'gain_life', value: 2, condition: 'three_plus_attacked' }],
  1059: [{ effect: 'grant_guard_self_if_two_plus_attack' }],
  1066: [{ effect: 'grant_guard_all_champions' }],
  1069: [{ effect: 'create_token', value: 1, condition: 'attacker_died_this_turn' }],
  1073: [
    { effect: 'stat_change_target', attackDelta: -1, lifeDelta: null },
    { effect: 'draw_cards', value: 1, condition: 'target_was_damaged' }
  ],
  1076: [{ effect: 'gain_life', value: 1, condition: 'discarded_cost_gte_4' }],
  1090: { split: [
    { effect: 'stat_change_target', attackDelta: -2, lifeDelta: null, condition: 'target_was_damaged' },
    { effect: 'stat_change_target', attackDelta: 0, lifeDelta: -1, condition: 'target_was_damaged' }
  ] },
  1093: [{ effect: 'next_decree_triggers_twice' }],
  1100: [{ effect: 'draw_cards', value: 1, condition: 'target_is_champion' }],
  1102: [{ effect: 'draw_cards', value: 1, condition: 'control_faction_champion' }],
  1104: [{ effect: 'omen_draw_gain_life_if_neutral' }],
  1109: [{ effect: 'first_discard_cost_less' }],
  1110: [{ effect: 'omen_choice_draw_or_damage' }],
  1119: [{ effect: 'choose_faction_conditional_attack' }]
};

const cards = JSON.parse(fs.readFileSync(FILE, 'utf8'));
let replaced = 0;

for (let i = 0; i < cards.length; i++) {
  const card = cards[i];
  const repl = TABLE[card.id];
  if (!repl) continue;
  const abilityArr = Array.isArray(card.abilities) ? card.abilities : [];
  const isSplit = repl && repl.split && !Array.isArray(repl);
  const repls = isSplit ? repl.split : repl;
  const customIdx = abilityArr
    .map((a, idx) => (a && typeof a === 'object' && a.effect === 'custom' ? idx : -1))
    .filter(idx => idx >= 0);

  if (isSplit) {
    if (customIdx.length !== 1) {
      console.error(`Card ${card.id} ${card.name}: split expects 1 custom, found ${customIdx.length}. SKIPPED.`);
      continue;
    }
    const old = abilityArr[customIdx[0]];
    const merged = repls.map(r => ({ ...r, trigger: old.trigger, ...(old.oncePerTurn ? { oncePerTurn: true } : {}), ...(old.target ? { target: old.target } : {}) }));
    abilityArr.splice(customIdx[0], 1, ...merged);
    replaced += merged.length;
    continue;
  }

  if (customIdx.length !== repls.length) {
    console.error(`Card ${card.id} ${card.name}: expected ${repls.length} customs, found ${customIdx.length}. SKIPPED.`);
    continue;
  }
  for (let k = 0; k < customIdx.length; k++) {
    const old = abilityArr[customIdx[k]];
    const merged = { ...repls[k] };
    merged.trigger = old.trigger;
    if (old.oncePerTurn) merged.oncePerTurn = true;
    if (old.target) merged.target = old.target;
    abilityArr[customIdx[k]] = merged;
    replaced++;
  }
}

fs.writeFileSync(FILE, JSON.stringify(cards));
console.log(`Replaced ${replaced} custom abilities.`);

const after = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const customsLeft = after.filter(c => (c.abilities || []).some(a => a && a.effect === 'custom')).length;
console.log('custom abilities left:', customsLeft);
console.log('total cards:', after.length);
console.log('unique ids:', new Set(after.map(c => c.id)).size);
if (customsLeft > 0 || after.length !== 120 || new Set(after.map(c => c.id)).size !== 120) {
  console.error('VALIDATION FAILED');
  process.exit(1);
} else {
  console.log('VALIDATION OK');
}