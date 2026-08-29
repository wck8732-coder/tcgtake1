/*
 * rules_engine.js - CANONICAL RULES ENGINE (strict module)
 * =========================================================
 * Single source of truth for game rules. Consumed by:
 *   - simulate.js  (headless harness: requires this module)
 *   - game.js      (browser UI layer: class GameState extends RULES_ENGINE.GameState)
 *   - recall_ominous_test.js (test harness, via simulate.js re-export)
 *
 * Pure engine: no DOM, no fs, no I/O. Extracted from simulate.js; includes the
 * game.js-only rules (totalLandsOfColor, removeBlocker, playerHasKeyword).
 * Shared with the browser via a script tag (global RULES_ENGINE) or require().
 */

(function(root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(
      require('./shared/utils'),
      require('./shared/keywords'),
      require('./shared/phases'),
      require('./shared/cost-utils'),
      require('./shared/factions')
    );
  } else {
    root.RULES_ENGINE = factory(root.SHARED, root.KEYWORDS, root.PHASES, root.COST, root.FACTIONS);
  }
})(typeof self !== 'undefined' ? self : this, function(SHARED, KEYWORDS, PHASES, COST, FACTIONS) {

// --- Utilities ---
function shuffle(arr) { return SHARED.shuffle(arr); }
function deepClone(obj) { return SHARED.deepClone(obj); }

// --- Stub log (no-op) ---
let logEnabled = false;
function log() {}
function debug() {}

// --- EventBus (real, mirrors game.js) ---
class EventBus {
  constructor() { this.listeners = {}; }
  on(event, fn) { (this.listeners[event] = this.listeners[event] || []).push(fn); }
  off(event, fn) { this.listeners[event] = (this.listeners[event] || []).filter(f => f !== fn); }
  emit(event, data) { (this.listeners[event] || []).forEach(fn => fn(data)); }
}
const bus = new EventBus();

// --- Card Renderer stub ---
const CardRenderer = { colorHex: function(c) { return FACTIONS.HEX[c] || '#555'; } };

// --- Player State ---
function createPlayer(name, isAI = false) {
  return {
    name, isAI, life: 20, deck: [], hand: [],
    battlefield: { champions: [], relics: [], domains: [], lands: [], omens: [] },
    graveyard: [],
    exile: [],
    mana: { Crimson: 0, Sunforged: 0, Lantern: 0, Gilded: 0, Colorless: 0 },
    landPlayedThisTurn: false, extraLandThisTurn: false, attackerIds: [],
    costDiscount: 0, costDiscountUses: 0, costTax: 0, recallDiscount: 0,
    cardsPlayedThisTurn: 0,
    _unitDiedThisTurn: false,
    _attackerDiedThisTurn: false,
    _attacksThisTurn: 0,
    _purgedWasHidden: false
  };
}

// --- GameState ---
class GameState {
  constructor(difficulty, deckKey, cardDB, deckDB, format = 'Classic') {
    this.CARD_DB = cardDB;
    this.CARD_MAP = new Map(cardDB.map(c => [c.id, c]));
    this.DECK_DB = deckDB;
    this.format = format;
    this.players = [createPlayer('Player', false), createPlayer('AI', true)];
    this.currentPlayer = 0;
    this.turnNumber = 1;
    this.phase = 'main1';
    this.difficulty = difficulty;
    this.gameOver = false;
    this.pendingAbility = null;
    this.deckKey = deckKey;
    this.combatStep = null;
    this.declaredAttackers = {};
    this.declaredBlockers = {};
    this.selectedCard = null;
    this.combatTargets = [];
    this.pendingBlockAssignment = null;
    this.stack = [];
    this.resolvingStack = false;
    this._awaitingResponse = false;
  }

  get me() { return this.players[0]; }
  get ai() { return this.players[1]; }
  get active() { return this.players[this.currentPlayer]; }
  get opponent() { return this.players[1 - this.currentPlayer]; }

  startGame() {
    const decks = this.getFormatDecks();
    const playerDeckDef = decks[this.deckKey];
    this.me.deck = this.buildDeckFromDef(playerDeckDef);
    this.me.hand = this.me.deck.splice(0, 7);

    const deckKeys = Object.keys(decks);
    const aiDeckKey = deckKeys[Math.floor(Math.random() * deckKeys.length)];
    this.aiDeckKey = aiDeckKey;
    this.ai.deck = this.buildDeckFromDef(decks[aiDeckKey]);
    this.ai.hand = this.ai.deck.splice(0, 7);
    this.updateUI();
    return { format: this.format, playerFaction: playerDeckDef.faction, aiFaction: decks[aiDeckKey].faction };
  }

  mulligan(player) {
    if (player.hand.length <= 1) return false;
    const newSize = player.hand.length - 1;
    const combined = shuffle(player.hand.concat(player.deck));
    player.hand = combined.slice(0, newSize);
    player.deck = combined.slice(newSize);
    log(`${player.name} mulligans to ${newSize} cards.`, 'info');
    this.updateUI();
    return true;
  }

  getFormatDecks() {
    if (this.DECK_DB.formats) {
      const format = this.DECK_DB.formats[this.format] || this.DECK_DB.formats.Classic;
      return format.decks;
    }
    return this.DECK_DB.decks || {};
  }

  getDeckDatabase() { return { decks: this.getFormatDecks() }; }

   buildDeckFromDef(deckDef) {
    const cardMap = this.CARD_MAP || new Map(this.CARD_DB.map(c => [c.id, c]));
    const counts = {};
    const deck = [];
    deckDef.cards.forEach(entry => {
      const card = cardMap.get(entry.id);
      if (!card) return;
      const count = Math.min(entry.count, 4);
      counts[entry.id] = (counts[entry.id] || 0) + count;
      if (counts[entry.id] > 4) console.warn('Deck ' + deckDef.name + ' exceeds 4 copies of ' + card.name);
      for (let i = 0; i < count; i++) {
        deck.push(deepClone(card));
      }
    });
    if (deck.length < 70) console.warn('Deck ' + deckDef.name + ' has only ' + deck.length + ' cards (minimum is 70)');
    return shuffle(deck);
  }

  // --- Mana ---
  normalizeCost(cost) { return COST.normalize(cost); }
  totalCostValue(cost) { return COST.totalValue(cost); }
  totalMana(player) { return player.battlefield.lands.filter(l => !l.tapped).length; }
  spentMana(player) { return Object.values(player.mana).reduce((s, v) => s + v, 0); }
  availableMana(player) { return this.totalMana(player); }
  canPayCost(player, cost) { return COST.canPay(player, cost); }
  payMana(player, cost) {
    const c = this.normalizeCost(cost);
    let remaining = c.generic + (c.color ? 1 : 0);
    if (c.color) {
      const coloredLands = player.battlefield.lands.filter(l => !l.tapped && l.color === c.color);
      if (coloredLands.length > 0) { coloredLands[0].tapped = true; remaining--; }
    }
    const allUntapped = player.battlefield.lands.filter(l => !l.tapped);
    for (const land of allUntapped) {
      if (remaining <= 0) break;
      land.tapped = true; remaining--;
    }
    return remaining <= 0;
  }
  resetMana(player) { player.mana = { Crimson: 0, Sunforged: 0, Lantern: 0, Gilded: 0, Colorless: 0 }; }

  // --- Cost Modification ---
  effectiveCost(player, cost) { return COST.effective(player, cost); }
  consumeCostDiscount(player) { COST.consumeDiscount(player); }

  // --- Exile / Purge ---
  purgeCard(player, card) {
    if (player.graveyard.includes(card)) {
      player.graveyard = player.graveyard.filter(c => c !== card);
    } else {
      player.battlefield.champions = player.battlefield.champions.filter(c => c !== card);
      player.battlefield.relics = player.battlefield.relics.filter(c => c !== card);
      player.battlefield.domains = player.battlefield.domains.filter(c => c !== card);
      player.battlefield.omens = player.battlefield.omens.filter(c => c !== card);
      player.hand = player.hand.filter(c => c !== card);
      if (card.type === 'Champion' && this.championHasKeyword(card, 'recall') && (card.recallCharges || 0) > 0) {
        card.recallCharges--;
      }
    }
    this._purgedWasHidden = card.faceDown === true;
    player.exile.push(card);
  }

  // --- Hidden Units (face-down Omens) ---
  hiddenUnits(player) {
    return player.battlefield.omens.filter(o => o.faceDown);
  }

  // --- Fog of War (state sanitization) ---
  getSanitizedBoardState(battlefield, isOwnBoard) {
    const zones = {};
    for (const zone of ['champions', 'relics', 'domains', 'omens', 'lands']) {
      zones[zone] = battlefield[zone].map(perm => {
        if (perm.faceDown && !isOwnBoard) {
          return {
            id: 'FACE_DOWN_OMEN',
            name: 'Face-Down Omen',
            type: 'Omen',
            faceDown: true,
            power: 2,
            toughness: 2,
            abilities: [],
            tapped: perm.tapped,
            summoned: perm.summoned
          };
        }
        return perm;
      });
    }
    return zones;
  }

  getSanitizedGameState(state, viewingPlayerIndex) {
    const players = state.players.map((p, idx) => {
      const isOwn = idx === viewingPlayerIndex;
      return {
        ...p,
        battlefield: this.getSanitizedBoardState(p.battlefield, isOwn),
        hand: isOwn ? p.hand : p.hand.map(() => ({ id: 'HIDDEN_CARD', name: 'Card' }))
      };
    });
    return { ...state, players };
  }

  // --- Draw ---
  drawCard(player) {
    if (player.deck.length === 0) {
      player.life = 0;
      this.processAbilities('on_discard', { player, card: null });
      this.checkWin();
      return null;
    }
    const card = player.deck.shift();
    if (player.hand.length >= 7) {
      player.graveyard.push(card);
      this.processAbilities('on_discard', { player, card });
      log(`${player.name} discards ${card.name} (hand full).`, 'info');
    } else {
      player.hand.push(card);
    }
    this.processAbilities('on_draw', { player, card });
    if (this.phase !== 'draw') {
      this.processAbilities('on_non_draw_step', { player, card });
    }
    return card;
  }

  // --- Playing Cards ---
  playLand(player, cardIndex) {
    const canPlayExtra = player.landPlayedThisTurn && this.hasStaticAbility(player, 'extra_land_per_turn');
    if (player.landPlayedThisTurn && !canPlayExtra) return false;
    const card = player.hand[cardIndex];
    if (!card || card.type !== 'Land') return false;
    player.hand.splice(cardIndex, 1);
    player.battlefield.lands.push(card);
    if (!canPlayExtra) player.landPlayedThisTurn = true;
    this.updateUI();
    return true;
  }

  playChampion(player, cardIndex) {
    const card = player.hand[cardIndex];
    if (!card || card.type !== 'Champion') return false;
    if (!this.canPayCost(player, this.effectiveCost(player, card.cost))) return false;
    this.payMana(player, this.effectiveCost(player, card.cost));
    this.consumeCostDiscount(player);
    player.hand.splice(cardIndex, 1);
    // Ominous champions deploy face-down as hidden units
    if (this.championHasKeyword(card, 'ominous')) {
      card.faceDown = true;
      card.turnPlayed = this.turnNumber;
      player.battlefield.omens.push(card);
      this.updateUI();
      return true;
    }
    card.summoned = true;
    card.tapped = false;
    player.battlefield.champions.push(card);
    this.processAbilities('enter_battlefield', { player, card });
    this.processAbilities('on_cast', { player, card });
    this.processAbilities('on_champion_played', { player, card });
    this.noteCardPlayed(player, card);
    this.applyStaticAbilities(player);
    this.updateUI();
    return true;
  }

  playRelic(player, cardIndex) {
    const card = player.hand[cardIndex];
    if (!card || card.type !== 'Relic') return false;
    if (!this.canPayCost(player, this.effectiveCost(player, card.cost))) return false;
    this.payMana(player, this.effectiveCost(player, card.cost));
    this.consumeCostDiscount(player);
    player.hand.splice(cardIndex, 1);
    player.battlefield.relics.push(card);
    this.processAbilities('on_cast', { player, card });
    this.noteCardPlayed(player, card);
    this.applyStaticAbilities(player);
    this.updateUI();
    return true;
  }

  playDomain(player, cardIndex) {
    const card = player.hand[cardIndex];
    if (!card || card.type !== 'Domain') return false;
    if (!this.canPayCost(player, this.effectiveCost(player, card.cost))) return false;
    this.payMana(player, this.effectiveCost(player, card.cost));
    this.consumeCostDiscount(player);
    player.hand.splice(cardIndex, 1);
    player.battlefield.domains.push(card);
    this.processAbilities('on_cast', { player, card });
    this.noteCardPlayed(player, card);
    this.applyStaticAbilities(player);
    this.updateUI();
    return true;
  }

  playOmen(player, cardIndex) {
    const card = player.hand[cardIndex];
    if (!card || card.type !== 'Omen') return false;
    if (!this.canPayCost(player, this.effectiveCost(player, card.cost))) return false;
    this.payMana(player, this.effectiveCost(player, card.cost));
    this.consumeCostDiscount(player);
    player.hand.splice(cardIndex, 1);
    card.faceDown = true;
    card.turnPlayed = this.turnNumber;
    player.battlefield.omens.push(card);
    this.noteCardPlayed(player, card);
    this.updateUI();
    return true;
  }

  playSpell(player, cardIndex, targets, userId, deferResolve = false) {
    const card = player.hand[cardIndex];
    if (!card || (card.type !== 'Spell' && card.type !== 'Instant' && card.type !== 'Decree')) return false;
    if (!this.canPayCost(player, this.effectiveCost(player, card.cost))) return false;
    this.payMana(player, this.effectiveCost(player, card.cost));
    this.consumeCostDiscount(player);
    player.hand.splice(cardIndex, 1);
    this.stack.push({ proc: this.players.indexOf(player), type: 'Player Card', sourceCard: card, targets: targets, userId: userId });
    log(`${player.name} casts ${card.name}.`, 'play');
    this.processGameEvent('ON_OPPONENT_SPELL', { spell: card, casterId: this.players.indexOf(player) }, deferResolve);
    this.updateUI();
    return true;
  }

  noteCardPlayed(player, card) {
    player.cardsPlayedThisTurn = (player.cardsPlayedThisTurn || 0) + 1;
    if (player.cardsPlayedThisTurn === 2) {
      this.processAbilities('on_second_card_played', { player, card });
    }
  }

  // --- Combat ---
  declareAttacker(player, championIndex) {
    const champion = player.battlefield.champions[championIndex];
    if (!champion || champion.tapped) return false;
    const hasHaste = this.championHasKeyword(champion, 'haste');
    if (champion.summoned && !hasHaste) return false;
    champion.attacking = true;
    this.declaredAttackers[champion.id] = true;
    if (!this.championHasKeyword(champion, 'vigilance')) champion.tapped = true;
    player.attackerIds.push(champion.id);
    player._attacksThisTurn = (player._attacksThisTurn || 0) + 1;
    this.processGameEvent('ON_ENEMY_ATTACK', { champion: champion, attackerId: champion.id, attackerOwnerId: this.players.indexOf(player) });
    this.processAbilities('attacks', { player, card: champion });
    const defender = player === this.me ? this.ai : this.me;
    this.processAbilities('on_enemy_attack', { player: defender, card: champion });
  }

  assignBlocker(attackerId, blockerId) {
    const attacker = this.me.battlefield.champions.find(c => c.id === attackerId)
      || this.ai.battlefield.champions.find(c => c.id === attackerId);
    const defender = this.currentPlayer === 0 ? this.me : this.ai;
    const blocker = defender.battlefield.champions.find(c => c.id === blockerId);
    if (!attacker || !blocker || blocker.tapped) return false;
    if (!this.canBlock(attacker, blocker, this.active)) return false;
    if (!this.declaredBlockers[attackerId]) this.declaredBlockers[attackerId] = [];
    const existing = this.declaredBlockers[attackerId];
    if (existing.includes(blockerId)) return false;
    if (existing.length > 0 && !this.canBlockAsPartOfGroup(attacker, existing)) return false;
    const maxBlocks = this.getMaxBlocks(blocker);
    const currentBlocks = this.getCurrentBlockCount(blockerId);
    if (currentBlocks >= maxBlocks) return false;
    existing.push(blockerId);
    return true;
  }

  confirmAttackers() {
    const attacker = this.active;
    if (!attacker.attackerIds.length) {
      this.phase = 'main2';
      this.combatStep = null;
      this.updateUI();
      return;
    }
    this.combatStep = 'declare_blockers';
    if (attacker.isAI) {
      this.playerAssignBlockers();
    } else {
      this.aiAssignBlockers();
    }
    this.confirmBlockers();
  }

  confirmBlockers() {
    this.combatStep = 'combat_damage';
    this.resolveCombat();
    this.phase = 'main2';
    this.combatStep = null;
    this.updateUI();
  }

  playerAssignBlockers() {
    const attacker = this.ai;
    const defenders = this.me.battlefield.champions.filter(c => !c.tapped);
    for (const atk of attacker.battlefield.champions.filter(c => c.attacking)) {
      const validBlockers = defenders.filter(b =>
        this.canBlock(atk, b, attacker) &&
        (!this.declaredBlockers[atk.id] || !this.declaredBlockers[atk.id].includes(b.id)) &&
        this.getCurrentBlockCount(b.id) < this.getMaxBlocks(b)
      );
      if (this.championHasKeyword(atk, 'menace') && validBlockers.length < 2) continue;
      if (validBlockers.length > 0) {
        const bestBlocker = validBlockers.reduce((best, b) =>
          (b.toughness > best.toughness || (b.power >= atk.power && b.toughness >= atk.toughness)) ? b : best
        , validBlockers[0]);
        this.assignBlocker(atk.id, bestBlocker.id);
        if (this.championHasKeyword(atk, 'menace')) {
          const remaining = validBlockers.filter(b => b.id !== bestBlocker.id);
          if (remaining.length > 0) this.assignBlocker(atk.id, remaining[0].id);
        }
      }
    }
  }

  aiAssignBlockers() {
    const attacker = this.me;
    const defenders = this.ai.battlefield.champions.filter(c => !c.tapped);
    const attackers = attacker.battlefield.champions.filter(c => c.attacking);
    for (const atk of attackers) {
      const validBlockers = defenders.filter(b =>
        this.canBlock(atk, b, attacker) &&
        (!this.declaredBlockers[atk.id] || !this.declaredBlockers[atk.id].includes(b.id)) &&
        this.getCurrentBlockCount(b.id) < this.getMaxBlocks(b)
      );
      const minBlockers = this.getMinBlockersRequired(atk);
      if (validBlockers.length < minBlockers) continue;
      if (this.difficulty === 'easy') {
        if (validBlockers.length > 0) {
          this.assignBlocker(atk.id, validBlockers[0].id);
          if (minBlockers > 1 && validBlockers.length > 1) this.assignBlocker(atk.id, validBlockers[1].id);
        }
      } else if (this.difficulty === 'medium') {
        const goodBlockers = validBlockers.filter(b => b.toughness >= atk.power && b.power >= 1);
        if (goodBlockers.length > 0) {
          this.assignBlocker(atk.id, goodBlockers[0].id);
          if (minBlockers > 1 && goodBlockers.length > 1) this.assignBlocker(atk.id, goodBlockers[1].id);
        } else if (atk.power >= 3 && validBlockers.length > 0) {
          this.assignBlocker(atk.id, validBlockers[0].id);
          if (minBlockers > 1 && validBlockers.length > 1) this.assignBlocker(atk.id, validBlockers[1].id);
        }
      } else {
        const totalPower = attackers.reduce((s, a) => s + a.power, 0);
        if (totalPower >= this.ai.life || atk.power >= 4) {
          const sorted = [...validBlockers].sort((a, b) => a.power - b.power);
          const needed = Math.min(minBlockers, sorted.length);
          for (let i = 0; i < needed; i++) this.assignBlocker(atk.id, sorted[i].id);
        }
      }
    }
  }

  resolveCombat() {
    const attacker = this.active;
    const defender = this.opponent;
    const attackerChampions = attacker.attackerIds
      .map(id => attacker.battlefield.champions.find(c => c.id === id))
      .filter(Boolean);

    const attackerFirstStrike = [], attackerRegular = [];
    const defenderFirstStrike = [], defenderRegular = [];

    for (const atk of attackerChampions) {
      if (this.championHasKeyword(atk, 'double_strike') || this.championHasKeyword(atk, 'first_strike'))
        attackerFirstStrike.push(atk);
      else attackerRegular.push(atk);
    }

    const allBlockerIds = new Set();
    for (const blockers of Object.values(this.declaredBlockers))
      for (const bId of blockers) allBlockerIds.add(bId);
    for (const bId of allBlockerIds) {
      const blocker = defender.battlefield.champions.find(c => c.id === bId);
      if (!blocker) continue;
      if (this.championHasKeyword(blocker, 'double_strike') || this.championHasKeyword(blocker, 'first_strike'))
        defenderFirstStrike.push(blocker);
      else defenderRegular.push(blocker);
    }

    const effPower = (c) => this.statsInverted ? c.toughness : c.power;
    const effTough = (c) => this.statsInverted ? c.power : c.toughness;
    const reduceFor = (dmg, side) => Math.max(0, dmg - (side.combatDamageReduction || 0));
    const damageStat = (c, amount) => { if (this.statsInverted) c.power -= amount; else c.toughness -= amount; };

    const resolveDamageStep = (attackers, defenders) => {
      for (const atk of attackers) {
        if (effTough(atk) <= 0) continue;
        const blockerIds = this.declaredBlockers[atk.id] || [];
        const blockers = blockerIds.map(id => defender.battlefield.champions.find(c => c.id === id)).filter(Boolean);
        if (blockers.length > 0) {
          let damage = reduceFor(effPower(atk), defender);
          if (attacker._doubleDamageActive && atk.color === 'Crimson') damage *= 2;
          for (const b of blockers) {
            if (effTough(b) <= 0) continue;
            const dmg = Math.min(damage, effTough(b));
            damageStat(b, dmg);
            if (this.championHasKeyword(atk, 'deathtouch')) damageStat(b, effTough(b));
            if (this.championHasKeyword(atk, 'lifelink')) attacker.life += dmg + (attacker._drainHealExtra || 0);
            damage -= dmg;
            this.processGameEvent('ON_COMBAT_DAMAGE', { targetChampion: b, targetOwnerId: this.players.indexOf(defender), amount: dmg });
            if (effTough(b) <= 0) this.destroyChampion(defender, b);
            if (damage <= 0) break;
          }
          if (damage > 0 && this.championHasKeyword(atk, 'trample')) {
            defender.life -= damage;
            if (this.championHasKeyword(atk, 'lifelink')) attacker.life += damage + (attacker._drainHealExtra || 0);
            this.processGameEvent('ON_COMBAT_DAMAGE', { isFace: true, targetOwnerId: this.players.indexOf(defender), amount: damage });
          }
        } else {
          const dealt = reduceFor(effPower(atk) * (attacker._doubleDamageActive && atk.color === 'Crimson' ? 2 : 1), defender);
          defender.life -= dealt;
          if (this.championHasKeyword(atk, 'lifelink')) attacker.life += dealt + (attacker._drainHealExtra || 0);
          this.processGameEvent('ON_COMBAT_DAMAGE', { isFace: true, targetOwnerId: this.players.indexOf(defender), amount: dealt });
        }
        atk.tapped = true;
        atk.attacking = false;
      }
      for (const b of defenders) {
        if (effTough(b) <= 0) continue;
        const targetAtk = attackerChampions.find(a => (this.declaredBlockers[a.id] || []).includes(b.id));
        if (targetAtk && effTough(targetAtk) > 0) {
          const dmg = reduceFor(effPower(b) * (defender._doubleDamageActive && b.color === 'Crimson' ? 2 : 1), attacker);
          damageStat(targetAtk, dmg);
          if (this.championHasKeyword(b, 'deathtouch')) damageStat(targetAtk, effTough(targetAtk));
          if (this.championHasKeyword(b, 'lifelink')) defender.life += dmg + (defender._drainHealExtra || 0);
          this.processGameEvent('ON_COMBAT_DAMAGE', { targetChampion: targetAtk, targetOwnerId: this.players.indexOf(attacker), amount: dmg });
          if (effTough(targetAtk) <= 0) this.destroyChampion(attacker, targetAtk);
        }
      }
    };

    if (attackerFirstStrike.length > 0 || defenderFirstStrike.length > 0) {
      resolveDamageStep(attackerFirstStrike, defenderRegular);
      resolveDamageStep(defenderFirstStrike, attackerRegular.filter(a => effTough(a) > 0));
    }
    resolveDamageStep(attackerRegular.filter(a => effTough(a) > 0), defenderRegular.filter(b => effTough(b) > 0));
    resolveDamageStep(attackerFirstStrike.filter(a => effTough(a) > 0), defenderFirstStrike.filter(b => effTough(b) > 0));

    attacker.attackerIds = [];
    this.declaredAttackers = {};
    this.declaredBlockers = {};
    this.combatStep = null;
    this.checkWin();
    this.updateUI();
  }

  destroyChampion(player, champion) {
    const idx = player.battlefield.champions.indexOf(champion);
    if (idx !== -1) {
      player.battlefield.champions.splice(idx, 1);
      if (this.championHasKeyword(champion, 'recall') && (champion.recallCharges || 0) > 0) {
        champion.recallCharges--;
        player.exile.push(champion);
      } else {
        player.graveyard.push(champion);
      }
      this._unitDiedThisTurn = true;
      if (champion.attacking) this._attackerDiedThisTurn = true;
      this.processGameEvent('ON_ALLY_DIES', { victim: champion, ownerId: this.players.indexOf(player) });
      const opponent = player === this.me ? this.ai : this.me;
      this.processGameEvent('ON_ENEMY_DIES', { victim: champion, ownerId: this.players.indexOf(player) });
      this.processAbilities('dies', { player, card: champion });
      this.processAbilities('on_ally_dies', { player, victim: champion });
      if (player._returnFirstAllyDeath && !player._firstAllyDiedReturned && !player._returnFirstAllyDeathCard) {
        player._returnFirstAllyDeathCard = champion;
        player._firstAllyDiedReturned = true;
      }
      if (opponent && opponent.battlefield.champions) {
        this.processAbilities('on_enemy_dies', { player: opponent, victim: champion });
      }
      this.applyStaticAbilities(player);
    }
  }

  // --- Recall (return from exile at 2x cost) ---
  recallCost(card, player) {
    const discount = player ? (player.recallDiscount || 0) : 0;
    return Math.max(0, 2 * this.totalCostValue(card.cost) - discount);
  }
  recallableFromExile(player) {
    return player.exile.filter(c => c.type === 'Champion' && this.championHasKeyword(c, 'recall') && (c.recallCharges || 0) > 0);
  }
  isMaxRarity(card) {
    return !!card && (card.rarity === 'Legendary' || card.rarity === 'Mythic');
  }

  // Relaxed timing: max-rarity cards, and keyword/activated-driven uses (recall from exile),
  // may be invoked during ANY main phase (including the opponent's response window).
  relaxedTiming(card) {
    if (!card) return false;
    if (this.isMaxRarity(card)) return true;
    if (this.championHasKeyword(card, 'recall')) return true;
    return false;
  }

  // Typed, phase-gated response set used by the priority window. Each entry's legalNow()
  // reflects whether the defender may currently act with it. Board activated abilities are
  // a stub (mechanic not implemented yet).
  getViableResponses(player) {
    const entries = [];
    const inMain = this.phase === 'main1' || this.phase === 'main2';
    const pid = this.players.indexOf(player);
    for (let i = 0; i < player.hand.length; i++) {
      const card = player.hand[i];
      if (card.type === 'Instant' || card.type === 'Spell') {
        const cost = this.effectiveCost(player, card.cost);
        if (this.canPayCost(player, cost)) {
          entries.push({ kind: 'hand-instant', card, index: i, cost, relaxed: false, legalNow: () => true });
        }
      }
    }
    if (inMain) {
      for (const zc of this.recallableFromExile(player)) {
        const cost = this.effectiveCost(player, this.recallCost(zc, player));
        if (!this.canPayCost(player, cost)) continue;
        const relaxed = this.relaxedTiming(zc);
        entries.push({
          kind: 'zone-effect', card: zc, cost, relaxed,
          invoke: () => this.activateRecall(player, zc, relaxed),
          legalNow: () => this.currentPlayer === pid || relaxed
        });
      }
    }
    return entries;
  }

  activateRecall(player, card, relaxed = false) {
    if (!player.exile.includes(card)) return false;
    const cost = this.effectiveCost(player, this.recallCost(card, player));
    if (!this.canPayCost(player, cost)) return false;
    if (!['main1', 'main2'].includes(this.phase)) return false;
    if (relaxed && !this.relaxedTiming(card)) return false;
    this.payMana(player, cost);
    this.consumeCostDiscount(player);
    player.exile = player.exile.filter(c => c !== card);
    card.summoned = true;
    card.tapped = false;
    card.faceDown = false;
    player.battlefield.champions.push(card);
    this.processAbilities('enter_battlefield', { player, card });
    this.processAbilities('on_cast', { player, card });
    this.applyStaticAbilities(player);
    this.updateUI();
    return true;
  }

  canPayFlipCost(player, cost) {
    if (!cost) return true;
    const friendly = player.battlefield.champions;
    if (cost.selfDamage) return player.life > (cost.selfDamage || 0);
    if (cost.tapFriendly) return friendly.filter(c => !c.tapped).length >= (cost.tapFriendly || 0);
    if (cost.sacrificeChampion) return friendly.length >= (cost.sacrificeChampion || 0);
    if (cost.bounceFriendlyLand) return (player.battlefield.lands || []).length >= (cost.bounceFriendlyLand || 0);
    return true;
  }

  payFlipCost(player, cost) {
    if (!cost) return;
    const friendly = player.battlefield.champions;
    if (cost.selfDamage) {
      player.life -= cost.selfDamage;
      log(`${player.name} takes ${cost.selfDamage} damage to flip (flip cost).`, 'damage');
    }
    if (cost.tapFriendly) {
      const pool = friendly.filter(c => !c.tapped);
      const n = Math.min(cost.tapFriendly, pool.length);
      for (let i = 0; i < n; i++) pool[i].tapped = true;
      log(`${player.name} taps ${n} champion(s) to flip (flip cost).`, 'play');
    }
    if (cost.sacrificeChampion) {
      const n = Math.min(cost.sacrificeChampion, friendly.length);
      for (let i = 0; i < n; i++) this.destroyChampion(player, player.battlefield.champions[0]);
      log(`${player.name} sacrifices ${n} champion(s) to flip (flip cost).`, 'play');
    }
    if (cost.bounceFriendlyLand) {
      const lands = player.battlefield.lands || [];
      const n = Math.min(cost.bounceFriendlyLand, lands.length);
      for (let i = 0; i < n; i++) {
        const land = lands[lands.length - 1];
        player.battlefield.lands.splice(player.battlefield.lands.indexOf(land), 1);
        player.hand.push(land);
      }
      log(`${player.name} returns ${n} land(s) to hand to flip (flip cost).`, 'play');
    }
  }

  flipOmen(player, omen, eventType, context) {
    if (!omen.faceDown) return;
    const opponent = player === this.me ? this.ai : this.me;
    if (!this.canPayFlipCost(player, omen.flipCost)) {
      log(`${omen.name} can't flip — flip cost not met.`, 'play');
      return;
    }
    this.payFlipCost(player, omen.flipCost);
    omen.faceDown = false;
    if (omen.type === 'Champion') {
      const idx = player.battlefield.omens.indexOf(omen);
      if (idx !== -1) player.battlefield.omens.splice(idx, 1);
      // Summoning sickness only if flipped the same turn it was played from hand
      omen.summoned = omen.turnPlayed === this.turnNumber;
      omen.tapped = false;
      player.battlefield.champions.push(omen);
      log(`${omen.name} flips face-up onto the battlefield!`, 'play');
      this.processAbilities('enter_battlefield', { player, card: omen });
      // Champion-omens also fire their flip ability when they flip
      for (const fa of this.getOmenFlipAbilities(omen, eventType)) {
        this.executeAbility(fa, omen, player, opponent, context || {});
      }
      this.applyStaticAbilities(player);
    } else {
      log(`${omen.name} flips face-up!`, 'play');
      const flipAbilities = this.getOmenFlipAbilities(omen, eventType);
      for (const fa of flipAbilities) {
        this.executeAbility(fa, omen, player, opponent, context || {});
      }
      // Non-champion Omens resolve their ability then go to the graveyard
      const idx = player.battlefield.omens.indexOf(omen);
      if (idx !== -1) {
        player.battlefield.omens.splice(idx, 1);
        player.graveyard.push(omen);
      }
      this.applyStaticAbilities(player);
    }
    this.updateUI();
  }

  getOmenFlipAbilities(omen, eventType) {
    if (!omen.abilities) return [];
    const want = eventType || omen.flipTrigger;
    return omen.abilities.filter(a => typeof a === 'object' && a.effect && a.trigger &&
      (a.trigger === want || String(a.trigger).toLowerCase() === String(want || '').toLowerCase()));
  }

  getOmenFlipAbility(omen, eventType) {
    return this.getOmenFlipAbilities(omen, eventType)[0] || null;
  }

  evaluateFlipCondition(perm, triggerType) {
    if (perm.flipTrigger !== triggerType) return false;
    switch (triggerType) {
      case 'START_OF_TURN':
      case 'END_OF_TURN':
      case 'ON_COMBAT_DAMAGE':
      case 'ON_OPPONENT_SPELL':
      case 'ON_ALLY_DIES':
        return true;
      default:
        return false;
    }
  }

  checkOmenTriggers(triggerType) {
    const player = this.active;
    [...player.battlefield.omens]
      .filter(o => o.faceDown && this.evaluateFlipCondition(o, triggerType))
      .forEach(o => this.flipOmen(player, o, triggerType));
  }

  // --- Ability Stack (priority interrupt system) ---
  checkOmenCondition(player, omen, eventType, payload) {
    const pIdx = this.players.indexOf(player);
    switch (eventType) {
      case 'ON_OPPONENT_SPELL':
        return payload && payload.casterId !== undefined && payload.casterId !== pIdx;
      case 'ON_ALLY_DIES':
        return payload && payload.ownerId === pIdx;
      case 'ON_COMBAT_DAMAGE':
        return payload && payload.targetOwnerId === pIdx;
      case 'START_OF_TURN':
      case 'END_OF_TURN':
        return !payload || payload.ownerId === undefined || payload.ownerId === pIdx;
      default:
        return true;
    }
  }

  pushOmenToStack(omen, player, ability, eventType, payload) {
    this.stack.push({
      type: 'OMEN_EFFECT',
      sourceCard: omen,
      controller: player,
      ability,
      eventType,
      context: payload || {}
    });
  }

  resolveStack() {
    if (this.resolvingStack) return;
    this.resolvingStack = true;
    let depth = 0;
    try {
      while (this.stack.length > 0 && depth < 100) {
        depth++;
        const item = this.stack.pop();
        if (!item) break;
        if (item.type === 'Player Card') {
          const caster = this.players[item.proc];
          const card = item.sourceCard;
          const opponent = caster === this.me ? this.ai : this.me;
          caster.graveyard.push(card);
          if (card.type === 'Decree') {
            this.processAbilities('on_decree_played', { player: caster, card });
            if (caster._nextDecreeTriggersTwice) {
              this.processAbilities('on_decree_played', { player: caster, card });
              caster._nextDecreeTriggersTwice = false;
            }
          }
          this.processAbilities('on_cast', { player: caster, card, target: item.targets || null });
          this.noteCardPlayed(caster, card);
        } else {
          const opponent = item.controller === this.me ? this.ai : this.me;
          this.executeAbility(item.ability, item.sourceCard, item.controller, opponent, item.context || {});
        }
        if (this.gameOver) break;
      }
      if (depth >= 100 && this.stack.length > 0) {
        log(`Stack resolution hit depth limit — clearing ${this.stack.length} remaining item(s).`, 'warn');
        this.stack.length = 0;
      }
    } finally {
      this.resolvingStack = false;
    }
  }

  processGameEvent(eventType, payload, deferResolve = false) {
    bus.emit('omenEvent', { type: eventType, payload, game: this });
    const listeners = [];
    for (const p of this.players) {
      for (const o of [...p.battlefield.omens]) {
        if (!o.faceDown) continue;
        if (o.flipTrigger !== eventType) continue;
        if (!this.checkOmenCondition(p, o, eventType, payload)) continue;
        if (!this.canPayFlipCost(p, o.flipCost)) continue;
        listeners.push({ player: p, omen: o });
      }
    }
    for (const { player, omen } of listeners) {
      this.payFlipCost(player, omen.flipCost);
      const flipAbilities = this.getOmenFlipAbilities(omen, eventType);
      if (omen.type === 'Champion') {
        const idx = player.battlefield.omens.indexOf(omen);
        if (idx !== -1) player.battlefield.omens.splice(idx, 1);
        // Summoning sickness only if flipped the same turn it was played from hand
        omen.summoned = omen.turnPlayed === this.turnNumber;
        omen.tapped = false;
        omen.faceDown = false;
        player.battlefield.champions.push(omen);
        log(`${omen.name} flips face-up onto the battlefield!`, 'play');
        this.processAbilities('enter_battlefield', { player, card: omen });
      } else {
        omen.faceDown = false;
        log(`${omen.name} flips face-up!`, 'play');
      }
      this.applyStaticAbilities(player);
      for (const fa of flipAbilities) {
        this.pushOmenToStack(omen, player, fa, eventType, payload);
      }
      // Non-champion Omens resolve their ability then go to the graveyard
      if (omen.type !== 'Champion') {
        const idx = player.battlefield.omens.indexOf(omen);
        if (idx !== -1) {
          player.battlefield.omens.splice(idx, 1);
          player.graveyard.push(omen);
        }
      }
    }
    if (!deferResolve) this.resolveStack();
  }

  clearEndOfTurnEffects(player) {
    player.battlefield.champions.forEach(c => {
      if (c._eotPower) { c.power -= c._eotPower; c._eotPower = 0; }
      if (c._eotToughness) { c.toughness -= c._eotToughness; c._eotToughness = 0; }
      if (c._doubleDamage) c._doubleDamage = false;
      if (c.abilities) c.abilities = c.abilities.filter(a => !a._temp);
    });
    player._doubleDamageActive = false;
    player.combatDamageReduction = 0;
    player.costDiscount = 0;
    player.costDiscountUses = 0;
    player.costTax = 0;
    player.recallDiscount = 0;
    this.statsInverted = false;
    player._firstPurgeCostLess = 0;
    player._firstDiscardCostLess = 0;
    player._drainHealExtra = 0;
    player._returnFirstAllyDeath = false;
    player._omenDrawIfNeutral = false;
    player._omenChoiceEffect = null;
    player._pendingGuardGrants = [];
    player._attacksThisTurn = 0;
    player._unitDiedThisTurn = false;
    player._attackerDiedThisTurn = false;
  }

  destroyRelic(player, relic) {
    const idx = player.battlefield.relics.indexOf(relic);
    if (idx !== -1) {
      player.battlefield.relics.splice(idx, 1);
      player.graveyard.push(relic);
    }
  }

  destroyDomain(player, domain) {
    const idx = player.battlefield.domains.indexOf(domain);
    if (idx !== -1) {
      player.battlefield.domains.splice(idx, 1);
      player.graveyard.push(domain);
    }
  }

  destroyOmen(player, omen) {
    const idx = player.battlefield.omens.indexOf(omen);
    if (idx !== -1) {
      player.battlefield.omens.splice(idx, 1);
      player.graveyard.push(omen);
    }
  }

  bounceToHand(player, card) {
    let idx = player.battlefield.champions.indexOf(card);
    if (idx !== -1) { player.battlefield.champions.splice(idx, 1); player.hand.push(card); return; }
    idx = player.battlefield.relics.indexOf(card);
    if (idx !== -1) { player.battlefield.relics.splice(idx, 1); player.hand.push(card); return; }
    idx = player.battlefield.domains.indexOf(card);
    if (idx !== -1) { player.battlefield.domains.splice(idx, 1); player.hand.push(card); return; }
    idx = player.battlefield.lands.indexOf(card);
    if (idx !== -1) { player.battlefield.lands.splice(idx, 1); player.hand.push(card); return; }
  }

  // --- Ability System ---
  // --- Phase-Window System ---
  getPhaseWindows() { return PHASES.WINDOWS; }
  isAbilityAllowedInPhase(ability) { return PHASES.isAllowedInPhase(ability, this.phase); }

  checkCondition(ability, context, player, opponent) {
    if (!ability.condition) return true;
    switch (ability.condition) {
      case 'unit_died_this_turn':
        return this._unitDiedThisTurn === true;
      case 'revealed_was_omen':
        return context._revealedCard && context._revealedCard.type === 'Omen';
      case 'revealed_cost_lte_2':
        return context._revealedCard && this.totalCostValue(context._revealedCard.cost) <= 2;
      case 'purged_was_hidden':
        return this._purgedWasHidden === true;
      case 'target_attacked_this_turn':
        return context.target && context.target.attacking === true;
      case 'target_is_champion':
        return context.target && context.target.type === 'Champion' && !context.target.isFace;
      case 'control_faction_champion':
        return context.chosenFaction && player.battlefield.champions.some(c => c.color === context.chosenFaction);
      case 'discarded_cost_gte_4':
        return context.discardedCard && this.totalCostValue(context.discardedCard.cost) >= 4;
      case 'target_was_damaged':
        return context.target && (context.target._damagedThisTurn || (context.target._damageTaken && context.target._damageTaken > 0));
      case 'three_plus_attacked':
        return (player.attackerIds && player.attackerIds.length >= 3) || (player._attacksThisTurn >= 3);
      case 'attacker_died_this_turn':
        return this._attackerDiedThisTurn === true;
      default:
        return true;
    }
  }

  processAbilities(trigger, context) {
    const { player } = context;
    const opponent = player === this.me ? this.ai : this.me;
    const allPermanents = [
      ...player.battlefield.champions,
      ...player.battlefield.relics,
      ...player.battlefield.omens,
      ...player.battlefield.domains
    ];
    if (context.card && context.card.abilities && !allPermanents.includes(context.card)) {
      allPermanents.push(context.card);
    }
    for (const permanent of allPermanents) {
      if (!permanent.abilities) continue;
      // Face-down Omens flip when their trigger fires
      if (permanent.type === 'Omen' && permanent.faceDown) {
        const flipAbility = permanent.abilities.find(a => a.trigger === trigger);
        if (flipAbility) {
          this.flipOmen(player, permanent, trigger, context);
        }
        continue;
      }
      for (const ability of permanent.abilities) {
        if (ability.trigger !== trigger) continue;
        if (!this.isAbilityAllowedInPhase(ability)) continue;
        if (ability.oncePerTurn && permanent._usedAbilities && permanent._usedAbilities.has(ability.name)) continue;
        if (!this.checkCondition(ability, context, player, opponent)) continue;
        this.executeAbility(ability, permanent, player, opponent, context);
        if (ability.oncePerTurn) {
          if (!permanent._usedAbilities) permanent._usedAbilities = new Set();
          permanent._usedAbilities.add(ability.name);
        }
      }
    }
    if (trigger === 'enter_battlefield' || trigger === 'untap') {
      this.applyStaticAbilities(player);
    }
  }

  gainLife(player, amount) {
    if (!amount || amount <= 0) return;
    player.life += amount;
    this.processAbilities('on_gain_life', { player });
  }

  executeAbility(ability, source, player, opponent, context) {
    const enemyChampions = opponent.battlefield.champions;
    const friendlyChampions = player.battlefield.champions;

    switch (ability.effect) {
      case 'damage_all_enemies': {
        const dmg = ability.value;
        const targets = [...enemyChampions];
        for (const c of targets) {
          c.toughness -= dmg;
          if (c.toughness <= 0) this.destroyChampion(opponent, c);
        }
        break;
      }
      case 'damage_any_target': {
        const dmg = ability.value;
        if (enemyChampions.length > 0) {
          const target = enemyChampions[Math.floor(Math.random() * enemyChampions.length)];
          target.toughness -= dmg;
          if (target.toughness <= 0) this.destroyChampion(opponent, target);
        } else {
          opponent.life -= dmg;
        }
        break;
      }
      case 'damage_random_enemy': {
        const dmg = ability.value;
        if (enemyChampions.length > 0) {
          const target = enemyChampions[Math.floor(Math.random() * enemyChampions.length)];
          target.toughness -= dmg;
          if (target.toughness <= 0) this.destroyChampion(opponent, target);
        } else {
          opponent.life -= dmg;
        }
        break;
      }
      case 'damage_two_targets': {
        const dmg = ability.value;
        const targets = [...enemyChampions];
        for (let i = 0; i < Math.min(2, targets.length); i++) {
          targets[i]. toughness -= dmg;
          if (targets[i].toughness <= 0) this.destroyChampion(opponent, targets[i]);
        }
        if (targets.length === 0) opponent.life -= dmg * 2;
        break;
      }
      case 'damage_all_champions': {
        const dmg = ability.value;
        const allTargets = [...friendlyChampions, ...enemyChampions];
        for (const c of allTargets) {
          c.toughness -= dmg;
          if (c.toughness <= 0) {
            const owner = friendlyChampions.includes(c) ? player : opponent;
            this.destroyChampion(owner, c);
          }
        }
        break;
      }
      case 'damage_relic': {
        const dmg = ability.value;
        const enemyEnchants = opponent.battlefield.relics;
        if (enemyEnchants.length > 0) {
          const target = enemyEnchants[0];
          target.toughness = (target.toughness || 0) - dmg;
          if (target.toughness <= 0) this.destroyRelic(opponent, target);
        }
        break;
      }
      case 'create_token': {
        const count = ability.value;
        const tokenPower = ability.tokenPower || 1;
        const tokenToughness = ability.tokenToughness || 1;
        const tokenName = ability.tokenName || 'Token';
        for (let i = 0; i < count; i++) {
          const token = {
            id: Date.now() + i, name: tokenName, type: 'Champion', cost: 0,
            power: tokenPower, toughness: tokenToughness, color: 'Sunforged',
            abilities: [], summoned: false, tapped: false, isToken: true
          };
          friendlyChampions.push(token);
        }
        break;
      }
      case 'destroy_all_enemies': {
        const targets = [...enemyChampions];
        for (const c of targets) this.destroyChampion(opponent, c);
        break;
      }
      case 'destroy_weakest_enemy': {
        if (enemyChampions.length > 0) {
          const sorted = [...enemyChampions].sort((a, b) => a.power - b.power);
          this.destroyChampion(opponent, sorted[0]);
        }
        break;
      }
      case 'destroy_relic': {
        const enemyEnchants = opponent.battlefield.relics;
        if (enemyEnchants.length > 0) this.destroyRelic(opponent, enemyEnchants[0]);
        break;
      }
      case 'destroy_omen': {
        const enemyOmens = opponent.battlefield.omens;
        if (enemyOmens.length > 0) this.destroyOmen(opponent, enemyOmens[0]);
        break;
      }
      case 'destroy_all': {
        const allTargets = [...friendlyChampions, ...enemyChampions];
        for (const c of allTargets) {
          const owner = friendlyChampions.includes(c) ? player : opponent;
          this.destroyChampion(owner, c);
        }
        break;
      }
      case 'bounce_enemies':
      case 'bounce_all_enemies': {
        const count = ability.value || enemyChampions.length;
        for (let i = 0; i < Math.min(count, enemyChampions.length); i++) {
          this.bounceToHand(opponent, enemyChampions[0]);
        }
        break;
      }
      case 'bounce_two_enemies': {
        for (let i = 0; i < Math.min(2, enemyChampions.length); i++) {
          this.bounceToHand(opponent, enemyChampions[0]);
        }
        break;
      }
      case 'bounce_relic': {
        const enemyEnchants = opponent.battlefield.relics;
        if (enemyEnchants.length > 0) this.bounceToHand(opponent, enemyEnchants[0]);
        break;
      }
      case 'bounce_champion': {
        if (enemyChampions.length > 0) {
          this.bounceToHand(opponent, enemyChampions[Math.floor(Math.random() * enemyChampions.length)]);
        }
        break;
      }
      case 'draw_cards': {
        for (let i = 0; i < ability.value; i++) this.drawCard(player);
        break;
      }
      case 'return_from_graveyard': {
        const validCards = player.graveyard.filter(c => c.type === 'Champion');
        for (let i = 0; i < Math.min(ability.value, validCards.length); i++) {
          const card = validCards[i];
          const idx = player.graveyard.indexOf(card);
          if (idx !== -1) {
            player.graveyard.splice(idx, 1);
            card.toughness = card.toughness || 1;
            card.summoned = true;
            player.battlefield.champions.push(card);
          }
        }
        break;
      }
      case 'return_from_exile': {
        const validCards = player.exile.filter(c => c.type === 'Champion');
        for (let i = 0; i < Math.min(ability.value, validCards.length); i++) {
          const card = validCards[i];
          const idx = player.exile.indexOf(card);
          if (idx !== -1) {
            player.exile.splice(idx, 1);
            card.toughness = card.toughness || 1;
            card.summoned = true;
            player.battlefield.champions.push(card);
          }
        }
        break;
      }

      // --- Champion Control Effects ---
      case 'swap_champion': {
        const enemyPick = (context.target && !context.target.isFace && enemyChampions.includes(context.target)) ? context.target : (enemyChampions.length ? enemyChampions[Math.floor(Math.random() * enemyChampions.length)] : null);
        const friendlyPick = friendlyChampions.length ? friendlyChampions[Math.floor(Math.random() * friendlyChampions.length)] : null;
        if (enemyPick && friendlyPick) {
          const eIdx = opponent.battlefield.champions.indexOf(enemyPick);
          const fIdx = player.battlefield.champions.indexOf(friendlyPick);
          opponent.battlefield.champions.splice(eIdx, 1);
          player.battlefield.champions.splice(fIdx, 1);
          player.battlefield.champions.push(enemyPick);
          opponent.battlefield.champions.push(friendlyPick);
          log(`${source.name}: ${ability.name} swaps ${friendlyPick.name} with ${enemyPick.name}!`, 'play');
        }
        break;
      }
      case 'opponent_chooses_purge': {
        if (enemyChampions.length > 0) {
          const target = enemyChampions[Math.floor(Math.random() * enemyChampions.length)];
          this.purgeCard(opponent, target);
          log(`${source.name}: ${ability.name} makes ${opponent.name} purge ${target.name}!`, 'play');
        }
        break;
      }

      // --- Defensive Effects ---
      case 'reduce_combat_damage_all': {
        const v = ability.value || 1;
        player.combatDamageReduction = (player.combatDamageReduction || 0) + v;
        log(`${source.name}: ${ability.name} reduces all combat damage to ${player.name}'s side by ${v} this turn!`, 'play');
        break;
      }
      case 'invert_stats_all': {
        this.statsInverted = true;
        log(`${source.name}: ${ability.name} inverts all champions' power and toughness this turn!`, 'play');
        break;
      }
      case 'drain_life': {
        const dmg = ability.value;
        const extraHeal = player._drainHealExtra || 0;
        if (enemyChampions.length > 0) {
          const target = enemyChampions[Math.floor(Math.random() * enemyChampions.length)];
          target.toughness -= dmg;
          this.gainLife(player, dmg + extraHeal);
          if (target.toughness <= 0) this.destroyChampion(opponent, target);
        } else {
          opponent.life -= dmg;
          this.gainLife(player, dmg + extraHeal);
        }
        break;
      }
      case 'drain_all_opponents': {
        const dmg = ability.value;
        opponent.life -= dmg;
        this.gainLife(player, dmg);
        break;
      }
      case 'tap_enemy_champion': {
        const untappedEnemies = enemyChampions.filter(c => !c.tapped);
        if (untappedEnemies.length > 0) {
          untappedEnemies[Math.floor(Math.random() * untappedEnemies.length)].tapped = true;
        }
        break;
      }
      case 'sacrifice_then_damage': {
        const dmg = ability.value;
        if (friendlyChampions.includes(source)) {
          this.destroyChampion(player, source);
          this.processAbilities('on_sacrifice', { player, card: source });
          if (enemyChampions.length > 0) {
            const target = enemyChampions[Math.floor(Math.random() * enemyChampions.length)];
            target.toughness -= dmg;
            if (target.toughness <= 0) this.destroyChampion(opponent, target);
          } else {
            opponent.life -= dmg;
          }
        }
        break;
      }
      case 'ramp_search_land': {
        const landInDeck = player.deck.findIndex(c => c.type === 'Land');
        if (landInDeck !== -1) {
          const land = player.deck.splice(landInDeck, 1)[0];
          player.hand.push(land);
        }
        break;
      }
      case 'ramp_extra_land': {
        player.extraLandThisTurn = true;
        break;
      }

      // --- Purge / Exile Effects ---
      case 'purge_target': {
        const purgeTarget = context.target || (enemyChampions.length > 0 ? enemyChampions[Math.floor(Math.random() * enemyChampions.length)] : null);
        if (purgeTarget && !purgeTarget.isFace) {
          this.purgeCard(opponent, purgeTarget);
        } else if (context.target && context.target.isFace) {
          opponent.life -= ability.value || 3;
          this.checkWin();
        }
        break;
      }
      case 'purge_weakest': {
        if (enemyChampions.length > 0) {
          const sorted = [...enemyChampions].sort((a, b) => a.power - b.power);
          this.purgeCard(opponent, sorted[0]);
        }
        break;
      }
      case 'purge_all_enemies': {
        const targets = [...enemyChampions];
        for (const c of targets) this.purgeCard(opponent, c);
        break;
      }
      case 'purge_hidden': {
        const hidden = this.hiddenUnits(opponent);
        if (hidden.length > 0) {
          const target = context.target && !context.target.isFace && context.target.faceDown ? context.target : hidden[0];
          this.purgeCard(opponent, target);
        }
        break;
      }
      case 'purge_from_graveyard': {
        const count = ability.value || 1;
        const valid = opponent.graveyard.filter(c => c.type === 'Champion');
        for (let i = 0; i < Math.min(count, valid.length); i++) {
          this.purgeCard(opponent, valid[i]);
        }
        break;
      }
      case 'purge_relic': {
        const target = context.target || (opponent.battlefield.relics.length > 0 ? opponent.battlefield.relics[0] : null);
        if (target) this.purgeCard(opponent, target);
        break;
      }

      // --- Reveal Effects ---
      case 'reveal_card':
      case 'reveal_top_deck': {
        const count = ability.value || 1;
        const pool = ability.effect === 'reveal_card' ? player.hand : player.deck;
        pool.slice(0, count);
        this.processAbilities('on_reveal', { player, card: source });
        break;
      }
      case 'reveal_hidden': {
        const hidden = this.hiddenUnits(opponent);
        log(`${source.name}: ${ability.name} reveals all hidden cards!`, 'play');
        for (const o of hidden) {
          this.flipOmen(opponent, o, o.flipTrigger);
        }
        this.processAbilities('on_reveal', { player, card: source });
        break;
      }

      // --- Scry Effects ---
      case 'scry_1':
      case 'scry_2':
      case 'scry_3': {
        player.deck.slice(0, ability.value || 1);
        break;
      }

      // --- Discard Effects ---
      case 'draw_then_discard': {
        this.drawCard(player);
        if (player.hand.length > 0) {
          const disc = player.hand[Math.floor(Math.random() * player.hand.length)];
          player.hand.splice(player.hand.indexOf(disc), 1);
          player.graveyard.push(disc);
          this.processAbilities('on_discard', { player, card: disc });
        }
        break;
      }
      case 'draw_two_discard_one': {
        this.drawCard(player);
        this.drawCard(player);
        if (player.hand.length > 0) {
          const disc = player.hand[Math.floor(Math.random() * player.hand.length)];
          player.hand.splice(player.hand.indexOf(disc), 1);
          player.graveyard.push(disc);
          this.processAbilities('on_discard', { player, card: disc });
        }
        break;
      }
      case 'discard_opponent': {
        const count = ability.value || 1;
        for (let i = 0; i < count; i++) {
          if (opponent.hand.length > 0) {
            const disc = opponent.hand[Math.floor(Math.random() * opponent.hand.length)];
            opponent.hand.splice(opponent.hand.indexOf(disc), 1);
            opponent.graveyard.push(disc);
            this.processAbilities('on_discard', { player: opponent, card: disc });
          }
        }
        break;
      }
      case 'draw_then_discard_gain_life': {
        this.drawCard(player);
        if (player.hand.length > 0) {
          const disc = player.hand[Math.floor(Math.random() * player.hand.length)];
          player.hand.splice(player.hand.indexOf(disc), 1);
          player.graveyard.push(disc);
          this.processAbilities('on_discard', { player, card: disc });
          if (this.totalCostValue(disc.cost) >= (ability.value || 4)) this.gainLife(player, 1);
        }
        break;
      }

      // --- Ready (Untap) Effects ---
      case 'ready_champion': {
        const readyTarget = context.target || (friendlyChampions.filter(c => c.tapped).length > 0 ? friendlyChampions.filter(c => c.tapped)[0] : friendlyChampions[0]);
        if (readyTarget) readyTarget.tapped = false;
        break;
      }
      case 'ready_two_champions': {
        const targets = friendlyChampions.filter(c => c.tapped).slice(0, 2);
        const any = targets.length ? targets : friendlyChampions.slice(0, 2);
        for (const c of any) {
          c.tapped = false;
          c.power += ability.value || 0;
        }
        break;
      }
      case 'ready_all_champions': {
        for (const c of friendlyChampions) c.tapped = false;
        break;
      }

      // --- Cost Modification Effects ---
      case 'next_card_costs_less': {
        const v = ability.value || 1;
        player.costDiscount += v;
        player.costDiscountUses = 1;
        break;
      }
      case 'next_two_cards_cost_less': {
        const v = ability.value || 1;
        player.costDiscount += v;
        player.costDiscountUses = 2;
        break;
      }
      case 'next_opponent_card_costs_more': {
        opponent.costTax += ability.value || 1;
        break;
      }

      // --- Buff / Pump Effects ---
      case 'grant_swiftstrike_ally': {
        const grantTarget = context.target && !context.target.isFace ? context.target : (friendlyChampions.length ? friendlyChampions[0] : null);
        if (grantTarget && friendlyChampions.includes(grantTarget)) {
          grantTarget.abilities = grantTarget.abilities || [];
          grantTarget.abilities.push({ name: 'Granted Swiftstrike', trigger: 'static', effect: 'haste', _temp: true });
        }
        break;
      }
      case 'buff_crimson_attack': {
        const v = ability.value || 0;
        friendlyChampions.forEach(c => {
          if (c.color === 'Crimson') {
            c.power += v;
            c._eotPower = (c._eotPower || 0) + v;
          }
        });
        break;
      }
      case 'pump_stats_target': {
        const v = ability.value || 0;
        const pumpTarget = context.target && !context.target.isFace ? context.target : (friendlyChampions.length ? friendlyChampions[0] : null);
        if (pumpTarget && friendlyChampions.includes(pumpTarget)) {
          pumpTarget.power += v;
          pumpTarget.toughness += v;
          pumpTarget._eotPower = (pumpTarget._eotPower || 0) + v;
          pumpTarget._eotToughness = (pumpTarget._eotToughness || 0) + v;
        }
        break;
      }
      case 'pump_self_stats': {
        if (friendlyChampions.includes(source)) {
          source.power += ability.value;
          source.toughness += ability.value;
        }
        break;
      }
      case 'sacrifice_then_draw': {
        if (friendlyChampions.length > 0) {
          const sac = friendlyChampions[0];
          this.destroyChampion(player, sac);
          this.processAbilities('on_sacrifice', { player, card: sac });
          const count = ability.value || 1;
          for (let i = 0; i < count; i++) this.drawCard(player);
        }
        break;
      }
      case 'buff_ally_toughness': {
        const v = ability.value || 0;
        friendlyChampions.forEach(c => {
          if (c === source) return;
          c.toughness += v;
          c._eotToughness = (c._eotToughness || 0) + v;
        });
        break;
      }
      case 'buff_all_allies': {
        const v = ability.value || 0;
        friendlyChampions.forEach(c => {
          c.power += v;
          c.toughness += v;
          c._eotPower = (c._eotPower || 0) + v;
          c._eotToughness = (c._eotToughness || 0) + v;
        });
        break;
      }
      case 'double_fire_damage': {
        player._doubleDamageActive = true;
        break;
      }
      case 'recall_cost_less': {
        player.recallDiscount = (player.recallDiscount || 0) + (ability.value || 1);
        break;
      }

      // --- Hidden Targeting Effects ---
      case 'damage_hidden': {
        const dmg = ability.value;
        const hidden = this.hiddenUnits(opponent);
        if (hidden.length > 0) {
          const target = hidden[Math.floor(Math.random() * hidden.length)];
          target.toughness = (target.toughness || 1) - dmg;
          if (target.toughness <= 0) this.purgeCard(opponent, target);
        } else {
          opponent.life -= dmg;
        }
        break;
      }

      // --- New 120-Card Set Effects ---
      case 'each_player_lose_1': {
        const dmg = ability.value || 1;
        this.me.life -= dmg;
        this.ai.life -= dmg;
        this.checkWin();
        break;
      }
      case 'drain_heal_extra': {
        player._drainHealExtra = (player._drainHealExtra || 0) + (ability.value || 1);
        break;
      }
      case 'first_ally_dies_return_hand': {
        player._returnFirstAllyDeath = true;
        break;
      }
      case 'stat_change_target': {
        const atk = ability.attackDelta || 0;
        const life = ability.lifeDelta || 0;
        let target = context.target || (enemyChampions.length > 0 ? enemyChampions[Math.floor(Math.random() * enemyChampions.length)] : null);
        if (target) {
          if (atk !== 0) { target.power += atk; target._eotPower = (target._eotPower || 0) + atk; }
          if (life !== 0) { target.toughness += life; target._eotToughness = (target._eotToughness || 0) + life; }
        }
        break;
      }
      case 'first_purge_cost_less': {
        player._firstPurgeCostLess = (ability.value || 1);
        break;
      }
      case 'grant_guard_until_next_turn': {
        player._pendingGuardGrants = player._pendingGuardGrants || [];
        player._pendingGuardGrants.push({ value: 1, until: 'nextTurn' });
        break;
      }
      case 'gain_life': {
        this.gainLife(player, ability.value || 1);
        break;
      }
      case 'grant_guard_self_if_two_plus_attack': {
        const attackers = player.attackerIds.length;
        if (attackers >= 2) {
          this.addTemporaryGuard(source, 1);
        }
        break;
      }
      case 'grant_guard_all_champions': {
        for (const c of friendlyChampions) this.addTemporaryGuard(c, 1);
        break;
      }
      case 'next_decree_triggers_twice': {
        player._nextDecreeTriggersTwice = true;
        break;
      }
      case 'omen_draw_gain_life_if_neutral': {
        player._omenDrawIfNeutral = true;
        break;
      }
      case 'first_discard_cost_less': {
        player._firstDiscardCostLess = (ability.value || 1);
        break;
      }
      case 'omen_choice_draw_or_damage': {
        player._omenChoiceEffect = { effect: 'omen_choice_draw_or_damage', value: ability.value || 2 };
        break;
      }
      case 'choose_faction_conditional_attack': {
        const chosenFaction = context.chosenFaction || null;
        if (chosenFaction) {
          source._chosenFaction = chosenFaction;
          source._factionPump = (source._factionPump || 0) + (ability.value || 1);
        }
        break;
      }
      case 'omen_return_ally_with_1_life': {
        break;
      }
    }
    this.checkWin();
    this.updateUI();
  }

  addTemporaryGuard(champion, value) {
    if (!champion._tempGuard) champion._tempGuard = 0;
    champion._tempGuard += value || 1;
    champion.abilities = champion.abilities || [];
    champion.abilities.push({ name: 'Granted Guard', trigger: 'static', effect: 'guard', value: value || 1, _temp: true });
  }

  applyStaticAbilities(player) {
    const opponent = player === this.me ? this.ai : this.me;

    // Reset pump bonuses
    player.battlefield.champions.forEach(c => {
      if (c._staticPump) {
        c.power -= c._staticPump;
        c.toughness -= c._staticPump;
        c._staticPump = 0;
      }
      if (c._staticAtkPump) {
        c.power -= c._staticAtkPump;
        c._staticAtkPump = 0;
      }
      if (c._staticToughPump) {
        c.toughness -= c._staticToughPump;
        c._staticToughPump = 0;
      }
    });

    // Apply pump_all_champions from all permanents
    const allPermanents = [
      ...player.battlefield.champions,
      ...player.battlefield.relics,
      ...player.battlefield.domains
    ];

    // Re-derive global auras
    player._doubleDamageActive = allPermanents.some(p => p.abilities &&
      p.abilities.some(a => a.trigger === 'static' && a.effect === 'double_fire_damage'));
    player._drainHealExtra = 0;
    player.recallDiscount = 0;
    for (const permanent of allPermanents) {
      if (!permanent.abilities) continue;
      for (const ability of permanent.abilities) {
        if (ability.trigger !== 'static') continue;
        if (ability.effect === 'recall_cost_less') {
          player.recallDiscount = Math.max(player.recallDiscount, ability.value || 1);
        }
        if (ability.effect === 'drain_heal_extra') {
          player._drainHealExtra = Math.max(player._drainHealExtra || 0, ability.value || 1);
        }
      }
    }

    for (const permanent of allPermanents) {
      if (!permanent.abilities) continue;
      for (const ability of permanent.abilities) {
        if (ability.trigger !== 'static') continue;
        if (ability.effect === 'pump_all_champions' || ability.effect === 'pump_all' || ability.effect === 'buff_all_allies') {
          const targets = ability.scope === 'global'
            ? [...player.battlefield.champions, ...this.getOpponent(player).battlefield.champions]
            : player.battlefield.champions;
          targets.forEach(c => {
            c.power += ability.value;
            c.toughness += ability.value;
            c._staticPump = (c._staticPump || 0) + ability.value;
          });
        } else if (ability.effect === 'buff_crimson_attack') {
          const targets = ability.scope === 'global'
            ? [...player.battlefield.champions, ...this.getOpponent(player).battlefield.champions]
            : player.battlefield.champions;
          targets.forEach(c => {
            if (c.color === 'Crimson') {
              c.power += ability.value;
              c._staticAtkPump = (c._staticAtkPump || 0) + ability.value;
            }
          });
        } else if (ability.effect === 'buff_ally_toughness') {
          player.battlefield.champions.forEach(c => {
            if (c === permanent) return;
            c.toughness += ability.value;
            c._staticToughPump = (c._staticToughPump || 0) + ability.value;
          });
        }
      }
    }

    this.updateUI();
  }

  getOpponent(player) {
    return player === this.me ? this.ai : this.me;
  }

  hasStaticAbility(player, effectName) {
    const allPermanents = [...player.battlefield.champions, ...player.battlefield.relics, ...player.battlefield.domains];
    for (const permanent of allPermanents) {
      if (!permanent.abilities) continue;
      for (const ability of permanent.abilities) {
        if (ability.trigger === 'static' && ability.effect === effectName) return true;
      }
    }
    return false;
  }

  // --- Keywords ---
  getKeywords(card) { return KEYWORDS.getKeywords(card); }
  championHasKeyword(champion, keyword) { return KEYWORDS.championHasKeyword(champion, keyword); }

  canBlock(attacker, blocker, attackingPlayer) {
    if (blocker.tapped) return false;
    const attackerKeywords = this.getKeywords(attacker);
    const blockerKeywords = this.getKeywords(blocker);
    if (attackerKeywords.has('flying') && !blockerKeywords.has('flying') && !blockerKeywords.has('reach')) return false;
    if (attackerKeywords.has('unblockable')) return false;
    return true;
  }

  getMinBlockersRequired(attacker) { return this.championHasKeyword(attacker, 'menace') ? 2 : 1; }
  canBlockAsPartOfGroup(attacker, existingBlockers) {
    return existingBlockers.length + 1 >= this.getMinBlockersRequired(attacker);
  }

  getMaxBlocks(champion) {
    if (this.championHasKeyword(champion, 'bastion')) {
      return Number.MAX_SAFE_INTEGER;
    }
    let max = 1;
    if (this.championHasKeyword(champion, 'guard')) {
      max = champion.toughness;
    }
    return Math.max(max, 1);
  }

  getCurrentBlockCount(blockerId) {
    let count = 0;
    for (const blockers of Object.values(this.declaredBlockers)) {
      if (blockers.includes(blockerId)) count++;
    }
    return count;
  }

  // --- Phases ---
  nextPhase() {
    const phases = ['untap', 'draw', 'main1', 'combat', 'main2', 'end'];
    const idx = phases.indexOf(this.phase);
    this.phase = phases[(idx + 1) % phases.length];
    if (this.phase === 'untap') this.endTurn();
    else this.executePhase();
    this.updateUI();
  }

  executePhase() {
    const p = this.active;
    switch (this.phase) {
      case 'untap':
        p.battlefield.champions.forEach(c => { c.tapped = false; c.summoned = false; });
        p.battlefield.lands.forEach(l => { l.tapped = false; });
        this.resetMana(p);
        p.landPlayedThisTurn = false;
        p.extraLandThisTurn = false;
        p.cardsPlayedThisTurn = 0;
        [...p.battlefield.champions, ...p.battlefield.relics].forEach(c => {
          if (c._usedAbilities) c._usedAbilities.clear();
        });
        this.processAbilities('untap', { player: p });
        this.checkOmenTriggers('START_OF_TURN');
        break;
      case 'draw':
        this.drawCard(p);
        break;
      case 'combat':
        this.enterCombat();
        break;
      case 'end':
        this.clearEndOfTurnEffects(p);
        this.processAbilities('end_of_turn', { player: p });
        this.checkOmenTriggers('END_OF_TURN');
        break;
    }
  }

  enterCombat() {
    this.phase = 'combat';
    this.combatStep = 'declare_attackers';
    this.declaredAttackers = {};
    this.declaredBlockers = {};
    this.updateUI();
  }

  endTurn() {
    const active = this.players[this.currentPlayer];
    // Ominous champions flip face-up at the end of their controller's turn
    [...active.battlefield.omens]
      .filter(o => o.type === 'Champion' && o.faceDown && (o.flipTrigger === 'END_OF_TURN' || !o.flipTrigger))
      .forEach(o => this.flipOmen(active, o, 'END_OF_TURN'));
    this.phase = 'untap';
    this.currentPlayer = 1 - this.currentPlayer;
    if (this.currentPlayer === 0) this.turnNumber++;
    this.executePhase();
    this.updateUI();
  }

  checkWin() {
    if (this.me.life <= 0) { this.gameOver = true; this.winner = 1; }
    if (this.ai.life <= 0) { this.gameOver = true; this.winner = 0; }
  }

  // --- UI stub ---
  updateUI() {}

  // --- AI ---
  runAI() {
    if (this.gameOver || this.currentPlayer !== 1) return;
    const ai = this.ai;
    switch (this.phase) {
      case 'untap':
        this.phase = 'draw';
        this.drawCard(ai);
        this.updateUI();
        this.runAI();
        return;
      case 'draw':
        this.phase = 'main1';
        this.updateUI();
        this.runAI();
        return;
      case 'main1':
        this.aiMainPhase(ai);
        this.updateUI();
        this.phase = 'combat';
        this.runAI();
        return;
      case 'combat':
        this.aiCombat(ai);
        this.updateUI();
        if (this.phase === 'main2') {
          this.runAI();
        }
        return;
      case 'main2':
        this.aiMainPhase(ai);
        this.updateUI();
        this.endTurn();
        return;
    }
    this.updateUI();
  }

  aiMainPhase(ai) {
    const lands = ai.hand.filter(c => c.type === 'Land');
    if (lands.length > 0 && !ai.landPlayedThisTurn) {
      this.playLand(ai, ai.hand.indexOf(lands[0]));
    }
    const playable = ai.hand
      .map((c, i) => ({ card: c, index: i }))
      .filter(({ card }) => card.type !== 'Land' && this.canPayCost(ai, this.effectiveCost(ai, card.cost)))
      .sort((a, b) => this.aiCardValue(b.card) - this.aiCardValue(a.card));

    for (const { card, index } of playable) {
      if (!this.canPayCost(ai, this.effectiveCost(ai, card.cost))) continue;
      if (card.type === 'Champion') this.playChampion(ai, index);
      else if (card.type === 'Relic') this.playRelic(ai, index);
      else if (card.type === 'Domain') this.playDomain(ai, index);
      else if (card.type === 'Omen') this.playOmen(ai, index);
      else if (card.type === 'Spell' || card.type === 'Instant' || card.type === 'Decree') {
        // Improved targeting: prefer weakest champion to remove blockers; fall back to player life
        const champions = this.me.battlefield.champions;
        let targets = [];
        if (champions.length > 0) {
          // Sort by power (weakest first), prefer champions that can be removed
          targets = [...champions].sort((a, b) => a.power - b.power);
        }
        const hasValidTarget = targets.length > 0 &&
          (targets[0].power <= (this.aiCardValue(card) || 1) || this.totalCostValue(card.cost) > 4);
        this.playSpell(ai, index, hasValidTarget ? [targets[0]] : null);
        if (this._awaitingResponse === true) break;
        this.resolveStack();
      }
    }
    if (this._awaitingResponse === true) return;
    // Recall strongest recallable champions from exile
    const recallable = this.recallableFromExile(ai).sort((a, b) => this.aiCardValue(b) - this.aiCardValue(a));
    for (const card of recallable) {
      if (!this.canPayCost(ai, this.effectiveCost(ai, this.recallCost(card, ai)))) continue;
      this.activateRecall(ai, card);
    }
  }

  aiCombat(ai) {
    const attackers = ai.battlefield.champions.filter(c => {
      if (c.tapped) return false;
      const hasHaste = this.championHasKeyword(c, 'haste');
      if (c.summoned && !hasHaste) return false;
      return true;
    });
    if (this.difficulty === 'easy') {
      attackers.forEach(c => this.declareAttacker(ai, ai.battlefield.champions.indexOf(c)));
    } else if (this.difficulty === 'medium') {
      attackers.filter(c => c.power >= 2).forEach(c =>
        this.declareAttacker(ai, ai.battlefield.champions.indexOf(c)));
    } else {
      const aiIndex = this.players.indexOf(ai);
      const boardAdvantage = this.evaluateBoardStateForAI({ players: this.players, turnNumber: this.turnNumber, activePlayerIndex: this.currentPlayer }, aiIndex);
      const totalPower = attackers.reduce((s, c) => s + c.power, 0);
      if (totalPower >= this.me.life || boardAdvantage >= 0 || this.me.battlefield.champions.length < attackers.length) {
        attackers.forEach(c => this.declareAttacker(ai, ai.battlefield.champions.indexOf(c)));
      } else {
        attackers.filter(c => c.power >= 3).forEach(c =>
          this.declareAttacker(ai, ai.battlefield.champions.indexOf(c)));
      }
    }
    this.confirmAttackers();
  }

  evaluateBoardStateForAI(state, aiPlayerIndex) {
    const view = this.getSanitizedGameState(state, aiPlayerIndex);
    const aiBoard = view.players[aiPlayerIndex].battlefield;
    const oppBoard = view.players[1 - aiPlayerIndex].battlefield;
    let score = 0;
    const zones = ['champions', 'omens', 'relics', 'domains'];
    for (const zone of zones) {
      for (const perm of aiBoard[zone]) {
        if (perm.faceDown) score += (perm.power || 1) + (perm.toughness || 1);
        else if (perm.type === 'Champion') score += (perm.power || 1) + (perm.toughness || 1);
        else if (perm.type === 'Relic' || perm.type === 'Domain') score += 2;
      }
      for (const perm of oppBoard[zone]) {
        if (perm.faceDown) score -= 2.5;
        else if (perm.type === 'Champion') score -= (perm.power || 1) + (perm.toughness || 1);
        else if (perm.type === 'Relic' || perm.type === 'Domain') score -= 2;
      }
    }
    return score;
  }

  aiCardValue(card) {
    let v = 0;
    if (card.type === 'Champion') v = card.power + card.toughness;
    else if (card.type === 'Relic') v = 3;
    else if (card.type === 'Domain') v = 4;
    else if (card.type === 'Omen') v = 3;
    else if (card.type === 'Spell' || card.type === 'Instant' || card.type === 'Decree') v = 2;
    if (card.abilities && card.abilities.length) {
      v += 2;
      for (const ability of card.abilities) {
        if (typeof ability === 'object') {
          if (ability.effect === 'haste' || ability.effect === 'trample' || ability.effect === 'unblockable') v += 2;
          if (ability.effect === 'damage_all_enemies' || ability.effect === 'destroy_all_enemies') v += 3;
          if (ability.effect === 'invert_stats_all') v += 3;
          if (ability.effect === 'purge_target' || ability.effect === 'purge_weakest' || ability.effect === 'purge_all_enemies' || ability.effect === 'purge_hidden' || ability.effect === 'opponent_chooses_purge') v += 2;
          if (ability.effect === 'swap_champion' || ability.effect === 'destroy_weakest_enemy' || ability.effect === 'destroy_relic') v += 2;
          if (ability.effect === 'reduce_combat_damage_all') v += 2;
          if (ability.effect === 'damage_any_target' || ability.effect === 'damage_two_targets' || ability.effect === 'damage_all_champions') v += ability.value;
          if (ability.effect === 'create_token') v += ability.value;
          if (ability.effect === 'draw_cards' || ability.effect === 'draw_then_discard') v += ability.value;
         if (ability.effect === 'tap_enemy_champion' || ability.effect === 'bounce_champion' || ability.effect === 'bounce_relic' || ability.effect === 'ready_champion' || ability.effect === 'next_card_costs_less' || ability.effect === 'next_two_cards_cost_less' || ability.effect === 'next_opponent_card_costs_more') v += 1;
         if (ability.effect === 'each_player_lose_1') v += ability.value || 1;
         if (ability.effect === 'drain_heal_extra') v += 1;
         if (ability.effect === 'gain_life') v += ability.value || 1;
         if (ability.effect === 'next_decree_triggers_twice') v += 2;
         if (ability.effect === 'grant_guard_all_champions' || ability.effect === 'grant_guard_until_next_turn' || ability.effect === 'grant_guard_self_if_two_plus_attack') v += 1;
         if (ability.effect === 'first_purge_cost_less' || ability.effect === 'first_discard_cost_less') v += 1;
         if (ability.effect === 'stat_change_target') v += 1;
       }
      }
    }
    if (this.difficulty === 'hard' && this.totalCostValue(card.cost) <= 2) v += 1;
    if (card.rarity === 'Mythic' || card.rarity === 'Legendary') v += 2;
    if (card.type === 'Champion' && this.championHasKeyword(card, 'ominous')) v -= 1;
    if (card.flipCost) {
      if (card.flipCost.sacrificeChampion) v -= 2;
      if (card.flipCost.selfDamage) v -= 1;
      if (card.flipCost.tapFriendly) v -= 1;
      if (card.flipCost.bounceFriendlyLand) v -= 1;
    }
    return v;
  }

  // --- Full game loop (synchronous) ---
  runGame() {
    let safety = 0;
    while (!this.gameOver && safety < 2000) {
      safety++;
      if (this.currentPlayer === 1) {
        this.runAI();
      } else {
        this.runPlayer();
      }
    }
    if (safety >= 2000) {
      return { winner: -1, turns: this.turnNumber, reason: 'stalled' };
    }
    return {
      winner: this.winner,
      turns: this.turnNumber,
      reason: this.winner === 0 ? 'ai_life_zero' : 'player_life_zero',
      playerLife: this.me.life,
      aiLife: this.ai.life
    };
  }

  // --- Player AI (mirror of aiMainPhase/aiCombat for player slot) ---
  runPlayer() {
    const p = this.me;
    switch (this.phase) {
      case 'untap':
        this.phase = 'draw';
        this.drawCard(p);
        this.runPlayer();
        return;
      case 'draw':
        this.phase = 'main1';
        this.runPlayer();
        return;
      case 'main1':
        this.playerMainPhase(p);
        this.phase = 'combat';
        this.runPlayer();
        return;
      case 'combat':
        this.playerAutoCombat(p);
        if (this.phase === 'main2') this.runPlayer();
        return;
      case 'main2':
        this.playerMainPhase(p);
        this.endTurn();
        return;
    }
  }

  playerMainPhase(p) {
    const lands = p.hand.filter(c => c.type === 'Land');
    if (lands.length > 0 && !p.landPlayedThisTurn) {
      this.playLand(p, p.hand.indexOf(lands[0]));
    }
    const playable = p.hand
      .map((c, i) => ({ card: c, index: i }))
      .filter(({ card }) => card.type !== 'Land' && this.canPayCost(p, this.effectiveCost(p, card.cost)))
      .sort((a, b) => this.aiCardValue(b.card) - this.aiCardValue(a.card));
    for (const { card, index } of playable) {
      if (!this.canPayCost(p, this.effectiveCost(p, card.cost))) continue;
      if (card.type === 'Champion') this.playChampion(p, index);
      else if (card.type === 'Relic') this.playRelic(p, index);
      else if (card.type === 'Domain') this.playDomain(p, index);
      else if (card.type === 'Omen') this.playOmen(p, index);
      else if (card.type === 'Spell' || card.type === 'Instant' || card.type === 'Decree') {
        const targets = this.ai.battlefield.champions;
        this.playSpell(p, index, targets.length > 0 ? targets[0] : null);
        if (this._awaitingResponse === true) break;
        this.resolveStack();
      }
    }
    if (this._awaitingResponse === true) return;
    // Recall strongest recallable champions from exile
    const recallable = this.recallableFromExile(p).sort((a, b) => this.aiCardValue(b) - this.aiCardValue(a));
    for (const card of recallable) {
      if (!this.canPayCost(p, this.effectiveCost(p, this.recallCost(card, p)))) continue;
      this.activateRecall(p, card);
    }
  }

  playerAutoCombat(p) {
    const attackers = p.battlefield.champions.filter(c => {
      if (c.tapped) return false;
      const hasHaste = this.championHasKeyword(c, 'haste');
      if (c.summoned && !hasHaste) return false;
      return true;
    });
    attackers.filter(c => c.power >= 2).forEach(c =>
      this.declareAttacker(p, p.battlefield.champions.indexOf(c)));
    this.confirmAttackers();
  }

  totalLandsOfColor(player, color) { return player.battlefield.lands.filter(l => l.color === color && !l.tapped).length; }
  removeBlocker(attackerId, blockerId) {
    if (!this.declaredBlockers[attackerId]) return;
    this.declaredBlockers[attackerId] = this.declaredBlockers[attackerId].filter(id => id !== blockerId);
    if (this.declaredBlockers[attackerId].length === 0) delete this.declaredBlockers[attackerId];
    this.updateUI();
  }
  playerHasKeyword(player, keyword) { return KEYWORDS.playerHasKeyword(player, keyword); }
}

  return { GameState: GameState, createPlayer: createPlayer, EventBus: EventBus, bus: bus, shuffle: shuffle, deepClone: deepClone };
});
