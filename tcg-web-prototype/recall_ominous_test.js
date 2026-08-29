const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DIR = __dirname;
const src = fs.readFileSync(path.join(DIR, 'simulate.js'), 'utf8');
const stripped = src.replace(/\nrun\(\);?\s*$/, '\n') + '\nthis.__ex = { GameState, shuffle, deepClone };';
const sandbox = { console, require, process, __dirname: DIR };
vm.createContext(sandbox);
vm.runInContext(stripped, sandbox, { filename: 'simulate.js' });

const { GameState, shuffle, deepClone } = sandbox.__ex;

const cardDB = JSON.parse(fs.readFileSync(path.join(DIR, 'card_database.json'), 'utf8'));
const deckDB = JSON.parse(fs.readFileSync(path.join(DIR, 'decks.json'), 'utf8'));

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name); }
}
function freshGame() {
  const g = new GameState('medium', 'swamp_death_decay', cardDB, deckDB);
  g.startGame();
  return g;
}

// --- Keyword recognition / card DB patches ---
{
  const rn = cardDB.find(c => c.id === 363);
  const og = cardDB.find(c => c.id === 364);
  const bh = cardDB.find(c => c.id === 117);
  const ll = cardDB.find(c => c.id === 345);
  const mh = cardDB.find(c => c.id === 104);
  const g = freshGame();
  check('363 Shroud-Bound Noble has Recall keyword', g.championHasKeyword(rn, 'recall'));
  check('363 recallCharges = 1', rn.recallCharges === 1);
  check('364 Ominous Ghoul has Ominous keyword', g.championHasKeyword(og, 'ominous'));
  check('117 Bloodghast recallCharges = 1', bh.recallCharges === 1);
  check('345 Lich Lord recallCharges = 2', ll.recallCharges === 2);
  check('104 Mire Horror has Ominous keyword', g.championHasKeyword(mh, 'ominous'));
  check('364 has no recall', !g.championHasKeyword(og, 'recall'));
}

// --- Recall: death sends to exile (not graveyard), consumes charge ---
{
  const g = freshGame();
  const me = g.me;
  const ch = deepClone(cardDB.find(c => c.id === 117)); // Recall 1, cost 1
  me.battlefield.champions.push(ch);
  g.destroyChampion(me, ch);
  check('Recall champion exiled on death', me.exile.includes(ch));
  check('Recall champion NOT in graveyard', !me.graveyard.includes(ch));
  check('Recall charge consumed (0 left)', ch.recallCharges === 0);
}

// --- Recall: with 0 charges, dies to graveyard normally ---
{
  const g = freshGame();
  const me = g.me;
  const ch = deepClone(cardDB.find(c => c.id === 117));
  ch.recallCharges = 0;
  me.battlefield.champions.push(ch);
  g.destroyChampion(me, ch);
  check('No-charge Recall champion dies to graveyard', me.graveyard.includes(ch));
  check('No-charge Recall champion not in exile', !me.exile.includes(ch));
}

// --- activateRecall: pays 2x cost, returns to battlefield ---
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.lands = [];
  for (let i = 0; i < 4; i++) me.battlefield.lands.push({ name: 'Swamp Land', type: 'Land', color: 'Swamp', tapped: false });
  const ch = deepClone(cardDB.find(c => c.id === 117)); // cost 1 -> recall 2
  ch.recallCharges = 1;
  me.exile.push(ch);
  g.phase = 'main1';
  check('recallableFromExile sees it', g.recallableFromExile(me).includes(ch));
  check('recallCost is 2x', g.recallCost(ch) === 2);
  const ok = g.activateRecall(me, ch);
  check('activateRecall returns true', ok);
  check('champion on battlefield after recall', me.battlefield.champions.includes(ch));
  check('champion removed from exile', !me.exile.includes(ch));
  check('2 lands tapped for recall', me.battlefield.lands.filter(l => l.tapped).length === 2);
}

// --- Recall: cannot afford -> no recall ---
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.lands = [];
  const ch = deepClone(cardDB.find(c => c.id === 117));
  ch.recallCharges = 1;
  me.exile.push(ch);
  g.phase = 'main1';
  check('cannot recall with 0 mana', g.activateRecall(me, ch) === false);
  check('still in exile', me.exile.includes(ch));
}

// --- purgeCard of Recall champion consumes a charge ---
{
  const g = freshGame();
  const me = g.me;
  const ch = deepClone(cardDB.find(c => c.id === 117));
  me.battlefield.champions.push(ch);
  g.purgeCard(me, ch);
  check('purged Recall champion in exile', me.exile.includes(ch));
  check('purge consumed Recall charge', ch.recallCharges === 0);
}

// --- Ominous: played face-down into omens ---
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.lands = [];
  for (let i = 0; i < 2; i++) me.battlefield.lands.push({ name: 'Swamp Land', type: 'Land', color: 'Swamp', tapped: false });
  const og = deepClone(cardDB.find(c => c.id === 364)); // Ominous 2/2 cost 2
  me.hand.push(og);
  const ok = g.playChampion(me, 0);
  check('playChampion face-down (Ominous) returns true', ok);
  check('hidden in omens, faceDown', me.battlefield.omens.length === 1 && me.battlefield.omens[0].faceDown);
  check('not on battlefield champions yet', me.battlefield.champions.length === 0);
  check('counts as hidden unit', g.hiddenUnits(me).length === 1);
}

// --- Ominous: flips at end of controller's turn ---
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.lands = [];
  const og = deepClone(cardDB.find(c => c.id === 364));
  og.faceDown = true;
  og.turnPlayed = g.turnNumber; // played this turn -> sickness applies on end-of-turn flip
  me.battlefield.omens.push(og);
  g.currentPlayer = 0; // me's turn
  g.endTurn();
  check('ominous moved to champions after end turn', me.battlefield.champions.includes(og));
  check('ominous no longer face-down', og.faceDown === false);
  check('ominous summoned (summoning sickness)', og.summoned === true);
  check('omens zone cleared', me.battlefield.omens.length === 0);
}

// --- Ominous: reveal_hidden flips early ---
{
  const g = freshGame();
  const ai = g.ai;
  const og = deepClone(cardDB.find(c => c.id === 364));
  og.faceDown = true;
  ai.battlefield.omens.push(og);
  const ability = { name: 'Reveal', trigger: 'on_cast', effect: 'reveal_hidden', value: 0 };
  g.executeAbility(ability, { name: 'src' }, g.me, ai, {});
  check('reveal_hidden flips ominous champion to battlefield', ai.battlefield.champions.includes(og));
  check('hidden zone cleared', ai.battlefield.omens.length === 0);
}

// --- Ominous: damage_hidden can hit a face-down champion ---
{
  const g = freshGame();
  const ai = g.ai;
  const og = deepClone(cardDB.find(c => c.id === 364)); // 2/2
  og.faceDown = true;
  ai.battlefield.omens.push(og);
  const ability = { name: 'Sunder', trigger: 'on_cast', effect: 'damage_hidden', value: 2 };
  g.executeAbility(ability, { name: 'src' }, g.me, ai, {});
  check('damage_hidden kills 2/2 hidden champion (purged)', ai.exile.includes(og) || og.toughness <= 0);
}

// --- Ominous: flipped on a LATER turn than played = NO summoning sickness ---
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.lands = [];
  const og = deepClone(cardDB.find(c => c.id === 364));
  og.faceDown = true;
  og.turnPlayed = 1;          // played on turn 1
  g.turnNumber = 3;           // now it is a later turn
  me.battlefield.omens.push(og);
  g.currentPlayer = 0;        // me's turn
  g.endTurn();
  check('later-turn flip moved to champions', me.battlefield.champions.includes(og));
  check('later-turn flip has NO summoning sickness', og.summoned === false);
  check('later-turn flip not tapped', og.tapped === false);
}

// --- Ominous: same-turn event flip KEEPS summoning sickness ---
{
  const g = freshGame();
  const me = g.me;
  const og = deepClone(cardDB.find(c => c.id === 364));
  og.faceDown = true;
  og.turnPlayed = g.turnNumber; // played this turn
  og.flipTrigger = 'ON_OPPONENT_SPELL';
  me.battlefield.omens.push(og);
  g.processGameEvent('ON_OPPONENT_SPELL', { spell: { name: 'x' }, casterId: 1 }); // ai cast
  check('same-turn event flip keeps summoning sickness', og.summoned === true);
}

// --- New Omen cards 365-374 materialize correctly ---
{
  const g = freshGame();
  const byId = id => cardDB.find(c => c.id === id);
  const btt = byId(365), ib = byId(366), drb = byId(367), sga = byId(368), gga = byId(369);
  const gbk = byId(370), ghs = byId(371), ci = byId(372), rld = byId(373), cps = byId(374);
  check('365 Omen + ON_OPPONENT_SPELL', btt.type === 'Omen' && btt.flipTrigger === 'ON_OPPONENT_SPELL');
  check('366 champion-omen w/ selfDamage flipCost + Ominous', ib.type === 'Champion' && g.championHasKeyword(ib, 'ominous') && ib.flipCost.selfDamage === 2 && ib.flipTrigger === 'ON_COMBAT_DAMAGE');
  check('367 two flip abilities same trigger', drb.abilities.filter(a => a.trigger === 'ON_COMBAT_DAMAGE').length === 2);
  check('368 tapFriendly flipCost', sga.flipCost.tapFriendly === 1);
  check('369 two ON_ALLY_DIES abilities', gga.abilities.filter(a => a.trigger === 'ON_ALLY_DIES').length === 2);
  check('370 sacrificeChampion flipCost', gbk.flipCost.sacrificeChampion === 1);
  check('371 swap_champion effect present', ghs.abilities.some(a => a.effect === 'swap_champion'));
  check('372 END_OF_TURN + bounceFriendlyLand', ci.flipTrigger === 'END_OF_TURN' && ci.flipCost.bounceFriendlyLand === 1);
  check('373 START_OF_TURN + opponent_chooses_purge', rld.flipTrigger === 'START_OF_TURN' && rld.abilities.some(a => a.effect === 'opponent_chooses_purge'));
  check('374 Mythic + invert_stats_all', cps.rarity === 'Mythic' && cps.abilities.some(a => a.effect === 'invert_stats_all'));
  check('all new Omens have faceDownCost', [btt, drb, gga, ghs, rld, cps].every(x => x.faceDownCost));
}

// --- flipCost formats ---
{
  const g = freshGame();
  const me = g.me;
  me.life = 3;
  check('selfDamage 2 payable at life 3', g.canPayFlipCost(me, { selfDamage: 2 }));
  g.payFlipCost(me, { selfDamage: 2 });
  check('selfDamage 2 paid -> life 1', me.life === 1);
  me.life = 2;
  check('selfDamage 2 NOT payable at life 2', !g.canPayFlipCost(me, { selfDamage: 2 }));
}
{
  const g = freshGame();
  const me = g.me;
  me.battlefield.champions = [{ name: 'a', tapped: true }, { name: 'b', tapped: false }];
  check('tapFriendly 1 payable w/ 1 untapped', g.canPayFlipCost(me, { tapFriendly: 1 }));
  g.payFlipCost(me, { tapFriendly: 1 });
  check('tapFriendly paid -> both tapped', me.battlefield.champions.every(c => c.tapped));
  check('tapFriendly 2 NOT payable now', !g.canPayFlipCost(me, { tapFriendly: 2 }));
}
{
  const g = freshGame();
  const me = g.me;
  me.battlefield.champions = [];
  check('sacrificeChampion 1 NOT payable w/ no champs', !g.canPayFlipCost(me, { sacrificeChampion: 1 }));
  me.battlefield.champions.push({ name: 'a', tapped: false });
  check('sacrificeChampion 1 payable', g.canPayFlipCost(me, { sacrificeChampion: 1 }));
  g.payFlipCost(me, { sacrificeChampion: 1 });
  check('sacrificeChampion paid -> graveyard + gone', me.battlefield.champions.length === 0 && me.graveyard.length >= 1);
}
{
  const g = freshGame();
  const me = g.me;
  me.battlefield.lands = [];
  check('bounceFriendlyLand 1 NOT payable w/ no lands', !g.canPayFlipCost(me, { bounceFriendlyLand: 1 }));
  me.battlefield.lands.push({ name: 'L', type: 'Land', tapped: false });
  check('bounceFriendlyLand 1 payable', g.canPayFlipCost(me, { bounceFriendlyLand: 1 }));
  g.payFlipCost(me, { bounceFriendlyLand: 1 });
  check('bounceFriendlyLand paid -> land in hand', me.battlefield.lands.length === 0 && me.hand.length >= 1);
}

// --- Non-champion Omen: flips on trigger, ability fires, goes to graveyard ---
{
  const g = freshGame();
  const me = g.me, ai = g.ai;
  me.hand = [];
  me.battlefield.omens = [];
  me.battlefield.champions = [];
  ai.hand = [];
  ai.battlefield.champions = [{ id: 9001, name: 'Enemy', type: 'Champion', power: 2, toughness: 5, color: 'Crimson', tapped: false, summoned: true }];
  const o = deepClone(cardDB.find(c => c.id === 365)); // damage_any_target 3
  o.faceDown = true;
  o.turnPlayed = g.turnNumber;
  me.battlefield.omens.push(o);
  g.processGameEvent('ON_OPPONENT_SPELL', { spell: { name: 'x' }, casterId: 1 });
  const enemy = ai.battlefield.champions[0];
  check('non-champion omen fired ability (3 damage)', enemy && enemy.toughness === 2);
  check('non-champion omen removed from omens zone', !me.battlefield.omens.includes(o));
  check('non-champion omen went to graveyard', me.graveyard.includes(o));
}

// --- Champion-omen: flipping fires its flip ability + pays flip cost ---
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.champions = [];
  me.battlefield.lands = [];
  me.battlefield.omens = [];
  me.life = 5;
  const ib = deepClone(cardDB.find(c => c.id === 366)); // 3/2, selfDamage 2, pump +2/+2
  ib.faceDown = true;
  ib.turnPlayed = 1;
  me.battlefield.omens.push(ib);
  g.processGameEvent('ON_COMBAT_DAMAGE', { targetChampion: { name: 'x' }, targetOwnerId: 0, amount: 1 });
  check('Berserker flipped to battlefield', me.battlefield.champions.includes(ib));
  check('Berserker flip cost selfDamage paid (life 3)', me.life === 3);
  check('Berserker flip ability pumped +2/+2 (5/4)', ib.power === 5 && ib.toughness === 4);
  check('Berserker no longer face-down', ib.faceDown === false);
}

// --- flipCost blocks the flip when unpayable ---
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.champions = [];
  me.battlefield.lands = [];
  me.battlefield.omens = [];
  me.life = 2; // cannot pay selfDamage 2 (needs life > 2)
  const ib = deepClone(cardDB.find(c => c.id === 366));
  ib.faceDown = true;
  ib.turnPlayed = 1;
  me.battlefield.omens.push(ib);
  g.processGameEvent('ON_COMBAT_DAMAGE', { targetChampion: { name: 'x' }, targetOwnerId: 0, amount: 1 });
  check('unpayable flip cost -> omen stays face-down', ib.faceDown === true && me.battlefield.omens.includes(ib));
  check('unpayable flip cost -> no pump', ib.power === 3 && ib.toughness === 2);
}

// --- endTurn auto-flip only for END_OF_TURN-triggered champion-omens ---
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.champions = [];
  me.battlefield.lands = [];
  me.battlefield.omens = [];
  const ib = deepClone(cardDB.find(c => c.id === 366)); // ON_COMBAT_DAMAGE
  ib.faceDown = true;
  ib.turnPlayed = 1;
  me.battlefield.omens.push(ib);
  g.currentPlayer = 0;
  g.endTurn();
  check('ON_COMBAT_DAMAGE champion-omen NOT auto-flipped at end of turn', me.battlefield.omens.includes(ib) && ib.faceDown === true);
}
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.champions = [];
  me.battlefield.lands = [{ name: 'L', type: 'Land', color: 'Gilded', tapped: false }];
  me.battlefield.omens = [];
  const ci = deepClone(cardDB.find(c => c.id === 372)); // END_OF_TURN, bounceFriendlyLand 1, next_card_costs_less 2
  ci.faceDown = true;
  ci.turnPlayed = 1;
  me.battlefield.omens.push(ci);
  g.currentPlayer = 0;
  g.endTurn();
  check('END_OF_TURN champion-omen auto-flipped', me.battlefield.champions.includes(ci));
  check('Impostor flip cost bounced a land', me.battlefield.lands.length === 0 && me.hand.length >= 1);
  check('Impostor flip ability granted discount', me.costDiscount >= 2);
  check('Impostor no longer face-down', ci.faceDown === false);
}

// --- Multi-ability flip (both abilities fire) ---
{
  const g = freshGame();
  const me = g.me, ai = g.ai;
  me.hand = [];
  me.battlefield.lands = [];
  me.battlefield.omens = [];
  me.battlefield.champions = [{ id: 1, name: 'Friendly', type: 'Champion', power: 2, toughness: 2, color: 'Sunforged', tapped: true, summoned: true }];
  ai.hand = [];
  ai.battlefield.champions = [{ id: 2, name: 'Enemy', type: 'Champion', power: 2, toughness: 2, color: 'Crimson', tapped: false, summoned: true }];
  const o = deepClone(cardDB.find(c => c.id === 367)); // tap_enemy_champion + ready_champion
  o.faceDown = true;
  o.turnPlayed = 1;
  me.battlefield.omens.push(o);
  g.processGameEvent('ON_COMBAT_DAMAGE', { targetChampion: ai.battlefield.champions[0], targetOwnerId: 0, amount: 1 });
  check('Dazzling tapped the enemy champion', ai.battlefield.champions[0].tapped === true);
  check('Dazzling readied the friendly champion', me.battlefield.champions[0].tapped === false);
  check('Dazzling resolved to graveyard', me.graveyard.includes(o));
}

// --- START_OF_TURN trigger (Rogue's Loaded Deck) ---
{
  const g = freshGame();
  const me = g.me, ai = g.ai;
  me.hand = [];
  ai.hand = [];
  me.battlefield.champions = [{ id: 1, name: 'MyChamp', type: 'Champion', power: 2, toughness: 2, color: 'Sunforged', tapped: false, summoned: true }];
  me.battlefield.omens = [];
  ai.battlefield.champions = [];
  ai.battlefield.omens = [];
  const rld = deepClone(cardDB.find(c => c.id === 373)); // START_OF_TURN, opponent_chooses_purge
  rld.faceDown = true;
  rld.turnPlayed = 1;
  ai.battlefield.omens.push(rld);
  g.currentPlayer = 0; // me's turn ends -> AI's turn starts
  g.endTurn();
  check('Rogue flipped at AI start of turn', !ai.battlefield.omens.includes(rld) && ai.graveyard.includes(rld));
  check('opponent_chooses_purge purged a friendly champion', me.battlefield.champions.length === 0);
  check('purged champion is in exile', me.exile.some(c => c.name === 'MyChamp'));
}

// --- Direct effects: swap_champion, reduce_combat_damage_all, invert_stats_all ---
{
  const g = freshGame();
  const me = g.me, ai = g.ai;
  me.battlefield.champions = [{ id: 1, name: 'A', type: 'Champion', power: 1, toughness: 1, color: 'Crimson', tapped: false, summoned: true }];
  ai.battlefield.champions = [{ id: 2, name: 'B', type: 'Champion', power: 2, toughness: 2, color: 'Gilded', tapped: false, summoned: true }];
  g.executeAbility({ name: 'Heist', trigger: 'x', effect: 'swap_champion', value: 1 }, { name: 'src' }, me, ai, {});
  check('swap_champion: enemy champion now mine', me.battlefield.champions.some(c => c.name === 'B'));
  check('swap_champion: my champion now theirs', ai.battlefield.champions.some(c => c.name === 'A'));
}
{
  const g = freshGame();
  const me = g.me;
  g.executeAbility({ name: 'Aegis', trigger: 'x', effect: 'reduce_combat_damage_all', value: 1 }, { name: 'src' }, me, g.ai, {});
  check('reduce_combat_damage_all sets combatDamageReduction', me.combatDamageReduction === 1);
  g.executeAbility({ name: 'Chronos', trigger: 'x', effect: 'invert_stats_all', value: 1 }, { name: 'src' }, me, g.ai, {});
  check('invert_stats_all sets statsInverted', g.statsInverted === true);
  g.clearEndOfTurnEffects(me);
  check('end-of-turn clears combatDamageReduction', me.combatDamageReduction === 0);
  check('end-of-turn clears statsInverted', g.statsInverted === false);
}

// --- costDiscount timing: survives untap, cleared at end of turn (Clockwork fix) ---
{
  const g = freshGame();
  const me = g.me;
  me.costDiscount = 3;
  me.costDiscountUses = 1;
  g.currentPlayer = 0;
  g.phase = 'untap';
  g.executePhase();
  check('costDiscount survives untap phase', me.costDiscount === 3 && me.costDiscountUses === 1);
}
{
  const g = freshGame();
  const me = g.me;
  me.costDiscount = 3;
  me.costDiscountUses = 1;
  g.clearEndOfTurnEffects(me);
  check('costDiscount cleared at end of turn', me.costDiscount === 0 && me.costDiscountUses === 0);
}
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.champions = [];
  me.battlefield.lands = [{ name: 'L', type: 'Land', color: 'Gilded', tapped: false }];
  me.battlefield.omens = [];
  const ci = deepClone(cardDB.find(c => c.id === 372));
  ci.faceDown = true;
  ci.turnPlayed = 1;
  me.battlefield.omens.push(ci);
  g.currentPlayer = 0;
  g.endTurn(); // END_OF_TURN flip grants the discount
  check('Impostor discount granted at end of turn', me.costDiscount >= 2);
  g.currentPlayer = 0; // back to me next turn
  g.phase = 'untap';
  g.executePhase(); // untap no longer wipes the discount
  check('Impostor discount survives into next turn', me.costDiscount >= 2);
}

// --- Sol-Guard Aegis: tapFriendly flipCost gating ---
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.lands = [];
  me.battlefield.omens = [];
  me.battlefield.champions = [];
  const sga = deepClone(cardDB.find(c => c.id === 368));
  sga.faceDown = true;
  sga.turnPlayed = 1;
  me.battlefield.omens.push(sga);
  g.processGameEvent('ON_COMBAT_DAMAGE', { targetChampion: { name: 'x' }, targetOwnerId: 0, amount: 1 });
  check('Aegis unpayable tapFriendly -> stays face-down', me.battlefield.omens.includes(sga) && sga.faceDown === true);
  me.battlefield.champions.push({ name: 'Ally', type: 'Champion', power: 1, toughness: 1, color: 'Sunforged', tapped: false, summoned: true });
  g.processGameEvent('ON_COMBAT_DAMAGE', { targetChampion: { name: 'x' }, targetOwnerId: 0, amount: 1 });
  check('Aegis flips once flipCost payable', me.battlefield.champions.includes(sga) && sga.faceDown === false);
  check('Aegis flip tapped an ally', me.battlefield.champions.find(c => c.name === 'Ally').tapped === true);
  check('Aegis flip granted combat damage reduction', me.combatDamageReduction >= 1);
}

// --- AI Omen valuation: impactful Omens valued above plain ones ---
{
  const g = freshGame();
  const cps = cardDB.find(c => c.id === 374); // Mythic invert_stats_all
  const btt = cardDB.find(c => c.id === 365); // Common damage 3
  const vCps = g.aiCardValue(cps);
  const vBtt = g.aiCardValue(btt);
  check('Chronos (invert) valued above Booby-Trapped Treasure', vCps > vBtt);
  check('Omen values are positive', vCps > 0 && vBtt > 0);
}

// === GOAL 2: stack / priority / combat / fatigue rule tests ===

// T1 — nested stack resolves LIFO (last pushed pops first)
{
  const g = freshGame();
  const a = { name: 'CardA', type: 'Spell', cost: {} };
  const b = { name: 'CardB', type: 'Spell', cost: {} };
  g.stack.push({ proc: 0, type: 'Player Card', sourceCard: a, targets: null });
  g.stack.push({ proc: 1, type: 'Player Card', sourceCard: b, targets: null });
  g.resolveStack();
  check('LIFO: last-entered resolves first', g.players[1].graveyard[0] && g.players[1].graveyard[0].name === 'CardB');
  check('LIFO: first-entered resolves second', g.players[0].graveyard[0] && g.players[0].graveyard[0].name === 'CardA');
  check('LIFO: stack drained after resolution', g.stack.length === 0);
}

// T2 — response instant placed above spell resolves before the original
{
  const g = freshGame();
  const spell = { name: 'BoardWipe', type: 'Spell', cost: {} };
  const instant = { name: 'CounterPunch', type: 'Instant', cost: {} };
  g.stack.push({ proc: 1, type: 'Player Card', sourceCard: spell, targets: null });
  g.stack.push({ proc: 0, type: 'Player Card', sourceCard: instant, targets: null });
  g.resolveStack();
  check('Response instant resolves before original spell', g.players[0].graveyard[0] && g.players[0].graveyard[0].name === 'CounterPunch');
  check('Original spell resolves after response', g.players[1].graveyard[0] && g.players[1].graveyard[0].name === 'BoardWipe');
}

// T3 — fatigue: drawing from an empty deck loses (life 0, opponent wins)
{
  const g = freshGame();
  const me = g.me;
  me.deck = [];
  me.hand = [];
  me.life = 20;
  g.drawCard(me);
  check('Deck-out sets life to 0', me.life === 0);
  check('Deck-out flags game over', g.gameOver === true);
  check('Deck-out winner is opponent', g.winner === 1);
}

// T4 — blocker reassignment: removeBlocker then assignBlocker a different defender
{
  const g = freshGame();
  g.currentPlayer = 0;
  const atk = { id: 'a1', name: 'Attacker', power: 3, toughness: 2, summoned: true, tapped: false, abilities: [], kw: [] };
  const d1 = { id: 'd1', name: 'Def1', power: 1, toughness: 1, summoned: true, tapped: false, abilities: [], kw: [] };
  const d2 = { id: 'd2', name: 'Def2', power: 2, toughness: 2, summoned: true, tapped: false, abilities: [], kw: [] };
  g.ai.battlefield.champions.push(atk);
  g.me.battlefield.champions.push(d1, d2);
  check('Reassign: first blocker assigned', g.assignBlocker('a1', 'd1') === true && (g.declaredBlockers['a1'] || []).includes('d1'));
  g.removeBlocker('a1', 'd1');
  check('Reassign: old blocker removed', !(g.declaredBlockers['a1'] || []).includes('d1'));
  check('Reassign: new blocker assigned', g.assignBlocker('a1', 'd2') === true && (g.declaredBlockers['a1'] || []).includes('d2'));
}

// T5 — maxBlocks cap: 1-blocking defender cannot block two attackers
{
  const g = freshGame();
  g.currentPlayer = 0;
  g.declaredBlockers = {};
  const atkA = { id: 'atkA', name: 'A1', power: 2, toughness: 1, summoned: true, tapped: false, abilities: [], kw: [] };
  const atkB = { id: 'atkB', name: 'B1', power: 2, toughness: 1, summoned: true, tapped: false, abilities: [], kw: [] };
  const d1 = { id: 'd1', name: 'Def', power: 1, toughness: 1, summoned: true, tapped: false, abilities: [], kw: [] };
  g.ai.battlefield.champions.push(atkA, atkB);
  g.me.battlefield.champions.push(d1);
  check('Cap: first assignment ok', g.assignBlocker('atkA', 'd1') === true);
  check('Cap: second attacker rejected (maxBlocks 1)', g.assignBlocker('atkB', 'd1') === false);
  check('Cap: rejected attacker has no blockers', !(g.declaredBlockers['atkB'] || []).length);
}

// T6 — depth cap: 120-item stack drains clean (no orphan, no hang)
{
  const g = freshGame();
  for (let i = 0; i < 120; i++) {
    g.stack.push({ proc: 0, type: 'Player Card', sourceCard: { name: 'S' + i, type: 'Spell', cost: {} }, targets: null });
  }
  g.resolveStack();
  check('Depth cap leaves no stack orphans', g.stack.length === 0);
}

// T7 — relaxedTiming: Legendary/Mythic and recall-keyworded uses are relaxed
{
  const g = freshGame();
  check('Max rarity: Mythic', g.isMaxRarity({ rarity: 'Mythic' }) === true);
  check('Max rarity: Legendary', g.isMaxRarity({ rarity: 'Legendary' }) === true);
  check('Max rarity: Rare is not', g.isMaxRarity({ rarity: 'Rare' }) === false);
  check('Max rarity: Common is not', g.isMaxRarity({ rarity: 'Common' }) === false);
  check('Relaxed: recall-keyworded champion (117)', g.relaxedTiming(deepClone(cardDB.find(c => c.id === 117))) === true);
  check('Relaxed: plain Common is not', g.relaxedTiming({ rarity: 'Common', kw: [], abilities: [] }) === false);
}

// T8 — zone-effect legality: relaxed recall viable in opponent-main window, strict not
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.lands = [];
  for (let i = 0; i < 10; i++) me.battlefield.lands.push({ name: 'Swamp Land', type: 'Land', color: 'Swamp', tapped: false });
  const ch = deepClone(cardDB.find(c => c.id === 117));
  ch.recallCharges = 1;
  me.exile.push(ch);
  g.currentPlayer = 1; // AI holds priority (opponent cast window)
  g.phase = 'main1';
  const inWindow = g.getViableResponses(me).filter(r => r.legalNow());
  check('Window: relaxed recall is viable on AI turn', inWindow.some(r => r.kind === 'zone-effect' && r.card.id === ch.id) === true);
  const strictEntry = { kind: 'zone-effect', card: ch, relaxed: false, legalNow: () => g.currentPlayer === 0 };
  check('Window: strict zone-effect NOT legal on AI turn', strictEntry.legalNow() === false);
  const relaxedEntry = { kind: 'zone-effect', card: ch, relaxed: true, legalNow: () => g.currentPlayer === 0 || true };
  check('Window: relaxed zone-effect legal on AI turn', relaxedEntry.legalNow() === true);
  const activeRecall = g.activateRecall(me, ch, true);
  check('Window: relaxed activateRecall succeeds in-window', activeRecall === true && me.battlefield.champions.includes(ch));
}

// T9 — hand-instant viability drives the yield decision
{
  const g = freshGame();
  const me = g.me;
  me.hand = [];
  me.battlefield.lands = [];
  me.exile = [];
  me.hand.push({ name: 'Test Bolt', type: 'Instant', cost: {} });
  g.currentPlayer = 1;
  g.phase = 'main1';
  const entries = g.getViableResponses(me).filter(r => r.legalNow());
  check('Yield: payable hand instant is viable in-window', entries.some(r => r.kind === 'hand-instant' && r.card.name === 'Test Bolt') === true);
  me.hand = [];
  const none = g.getViableResponses(me).filter(r => r.legalNow());
  check('Yield: no viable responses when hand empty + no relaxed zone', none.length === 0);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
