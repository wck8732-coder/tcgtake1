// ============================================================
// TCG PROTOTYPE - Game Engine (Browser UI layer)
// ============================================================
// UI + async-AI layer. Rules live in rules_engine.js (canonical).
// class GameState extends RULES_ENGINE.GameState - methods defined
// here are the browser-specific overrides; pure rules are inherited.

// ============================================================
// TCG PROTOTYPE - Game Engine
// ============================================================

// --- Card Database ---
let CARD_DB = [];

// --- EventBus (shared with rules_engine.js via shared/utils.js) ---
const bus = SHARED.bus;

// --- Utility ---
function shuffle(arr) { return SHARED.shuffle(arr); }
function deepClone(obj) { return SHARED.deepClone(obj); }
function log(msg, type = 'info') {
  const el = document.querySelector('.log-entries');
  if (!el) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = msg;
  el.prepend(entry);
  if (el.children.length > 50) el.lastChild.remove();
  if (window.__DEBUG) console.log(`[${type}] ${msg}`);
}
function debug(...args) { if (window.__DEBUG) console.log('[DEBUG]', ...args); }

// --- Card Renderer ---
const CardRenderer = {
  create(cardData, context = {}) {
    const tpl = document.getElementById('card-template');
    const node = tpl.content.cloneNode(true);
    const el = node.querySelector('.card');

    el.dataset.id = cardData.id;
    el.dataset.color = cardData.color;
    el.dataset.type = cardData.type;
    if (cardData.rarity) el.dataset.rarity = cardData.rarity;

    // Format cost for display
    const formatCost = (c) => {
      if (c == null) return '0';
      if (typeof c === 'number') return String(c);
      if (typeof c === 'object') {
        const g = c.generic || 0;
        const col = c.color || '';
        if (!col) return String(g);
        return col[0] + String(g);
      }
      return String(c);
    };
    el.querySelector('.card-cost').textContent = formatCost(cardData.cost);
    el.querySelector('.card-name').textContent = cardData.name;
    el.querySelector('.card-type-line').textContent = `${cardData.color} ${cardData.type}`;
    el.querySelector('.card-color-badge').style.background = this.colorHex(cardData.color);

    const keywordDefs = KEYWORDS.DEFS;
    const describeAbility = EFFECTS.describe;

    const abilities = cardData.abilities || [];
    const foundKeywords = new Set();
    const kwDefs = Object.keys(keywordDefs).sort((a, b) => b.length - a.length);
    const kwRegExp = new RegExp('(' + kwDefs.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');

    // Append a text fragment, wrapping every keyword phrase in a tooltip span.
    const appendKeywordScan = (el, text) => {
      if (!text) return;
      let last = 0;
      let m;
      kwRegExp.lastIndex = 0;
      while ((m = kwRegExp.exec(text)) !== null) {
        if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
        const matchWord = m[0];
        const canonical = kwDefs.find(k => k.toLowerCase() === matchWord.toLowerCase());
        foundKeywords.add(canonical);
        const span = document.createElement('span');
        span.className = 'keyword';
        span.textContent = matchWord;
        span.dataset.tooltip = keywordDefs[canonical];
        el.appendChild(span);
        last = m.index + matchWord.length;
        if (m.index === kwRegExp.lastIndex) kwRegExp.lastIndex++;
      }
      if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
    };

    const textEl = el.querySelector('.card-text');
    textEl.innerHTML = '';

    // Authored rules text overrides the generated text; otherwise build from abilities.
    let textParts;
    if (cardData.text) {
      textParts = [cardData.text];
    } else if (abilities.length > 0) {
      textParts = abilities.map(a => {
        if (typeof a === 'object' && a.name && keywordDefs[a.name]) return a.name;
        return describeAbility(a);
      });
    } else if (cardData.type === 'Land') {
      textParts = ['Tap: Add 1 mana'];
    } else {
      textParts = [];
    }
    const parts = textParts.filter(t => t);
    parts.forEach((part, i) => {
      appendKeywordScan(textEl, part);
      if (i < parts.length - 1) textEl.appendChild(document.createTextNode('\n'));
    });

    // Flavor text (italic line under the rules box)
    const flavorEl = el.querySelector('.card-flavor');
    if (cardData.flavor && !context.faceDown) {
      flavorEl.textContent = cardData.flavor;
      flavorEl.classList.remove('hidden');
    } else {
      flavorEl.classList.add('hidden');
    }

    // Keyword footnotes
    const kwFooter = el.querySelector('.card-keywords');
    if (foundKeywords.size > 0) {
      const lines = [];
      foundKeywords.forEach(k => {
        lines.push(`${k} — ${keywordDefs[k]}`);
      });
      kwFooter.textContent = lines.join('\n');
      kwFooter.style.display = 'block';
    } else {
      kwFooter.style.display = 'none';
    }

    if (cardData.type !== 'Champion' && cardData.type !== 'Land') {
      el.querySelector('.card-stats').textContent = '';
    } else if (cardData.type === 'Champion') {
      el.querySelector('.card-stats').textContent = `${cardData.power}/${cardData.toughness}`;
    }

    // Rarity badge (crown icon)
    if (cardData.rarity && cardData.rarity !== 'Common') {
      const rBadge = el.querySelector('.card-rarity-badge');
      rBadge.textContent = '\u265B';
      rBadge.classList.remove('hidden');
      rBadge.dataset.rarity = cardData.rarity;
    }

    if (context.tapped) el.classList.add('tapped');
    if (context.selectable) el.classList.add('selectable');
    if (context.targetable) el.classList.add('targetable');
    if (context.faceDown) {
      el.querySelector('.card-name').textContent = '???';
      el.querySelector('.card-cost').textContent = '?';
      el.querySelector('.card-type-line').textContent = '';
      el.querySelector('.card-text').textContent = '';
      el.querySelector('.card-stats').textContent = '';
      el.querySelector('.card-rarity-badge').classList.add('hidden');
      el.querySelector('.card-keywords').style.display = 'none';
      el.dataset.color = '';
      el.dataset.type = '';
      el.dataset.rarity = '';
    }

    return el;
  },

  colorHex(color) { return FACTIONS.HEX[color] || '#555'; }
};

// --- Player State ---
function createPlayer(name, isAI = false) {
  return {
    name,
    isAI,
    life: 20,
    deck: [],
    hand: [],
    battlefield: { champions: [], relics: [], domains: [], lands: [], omens: [] },
    graveyard: [],
    exile: [],
    mana: { Crimson: 0, Sunforged: 0, Lantern: 0, Gilded: 0, Colorless: 0 },
    landPlayedThisTurn: false,
    extraLandThisTurn: false,
    attackerIds: [],
    costDiscount: 0,
    costDiscountUses: 0,
    costTax: 0,
    recallDiscount: 0,
    cardsPlayedThisTurn: 0,
    _unitDiedThisTurn: false,
    _attackerDiedThisTurn: false,
    _attacksThisTurn: 0,
    _purgedWasHidden: false
  };
}

// --- Game State ---
class GameState extends RULES_ENGINE.GameState {
  constructor(difficulty = 'easy', deckKey = null, format = 'Classic') {
    super(difficulty, deckKey, window.__CARD_DB__ || [], window.__DECK_DB__ || { decks: {} }, format);
    this.ai.name = 'Opponent';
  }


  startGame() {
    CARD_DB = window.__CARD_DB__;
    super.startGame();
    const decks = this.getFormatDecks();
    const playerDeckDef = decks[this.deckKey];

    // AI auto-mulligan bad hands (<2 lands or >5 lands)
    let aiLands = this.ai.hand.filter(c => c.type === 'Land').length;
    while (this.ai.hand.length > 1 && (aiLands < 2 || aiLands > 5)) {
      this.mulligan(this.ai);
      aiLands = this.ai.hand.filter(c => c.type === 'Land').length;
    }

    log('Game started! You are playing ' + playerDeckDef.name + '.', 'info');
    log('Opponent is playing ' + decks[this.aiDeckKey].name + ' (' + this.format + ').', 'info');
    bus.emit('gameStart');
  }

   // --- Mana ---
  // --- Cost Modification ---

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
      if (card.type === 'Champion' && this.championHasKeyword(card, 'recall') && (champion.recallCharges || 0) > 0) {
        card.recallCharges--;
      }
    }
    this._purgedWasHidden = card.faceDown === true;
    player.exile.push(card);
    log(`${card.name} is purged to exile.`, 'play');
  }

  // --- Hidden Units (face-down Omens) ---

  // --- Fog of War (state sanitization) ---


  // --- Drawing ---

  // --- Playing Cards ---
  playChampion(player, cardIndex) {
    const card = player.hand[cardIndex];
    if (!card || card.type !== 'Champion') return false;
    if (!this.canPayCost(player, this.effectiveCost(player, card.cost))) return false;
    debug(`playChampion: ${player.name} plays ${card.name} cost=${card.cost}`);
    const result = super.playChampion(player, cardIndex);
    if (!result) return false;
    if (card.faceDown) {
      log(`${player.name} plays ${card.name} face-down (Ominous).`, 'play');
      bus.emit('omenPlayed', { player, card });
    } else {
      log(`${player.name} summons ${card.name} (${card.power}/${card.toughness}).`, 'play');
      bus.emit('championEntered', { player, card });
    }
    return true;
  }




  // --- Ability Stack (priority interrupt system) ---



  playSpell(player, cardIndex, targets) {
    const card = player.hand[cardIndex];
    if (!card || (card.type !== 'Spell' && card.type !== 'Instant' && card.type !== 'Decree')) return false;
    if (!this.canPayCost(player, this.effectiveCost(player, card.cost))) return false;
    const proc = this.players.indexOf(player);
    const userId = card.id + ':' + proc + ':' + (Date.now() % 100000) + ':' + Math.floor(Math.random() * 1000);
    const viable = proc !== 0 ? this.getViableResponses(this.me).filter(r => r.legalNow()) : [];
    const deferResolve = proc !== 0 && viable.length > 0;
    const result = super.playSpell(player, cardIndex, targets, userId, deferResolve);
    if (!result) return false;
    if (!card.faceDown) {
      bus.emit('spellCast', { player, card, targets });
      // Player responding during an open window: close it — this spell landed on top of the
      // pending AI card, so LIFO resolution plays the response first, then the original.
      if (proc === 0 && this._responding) {
        const openModal = document.getElementById('response-modal');
        if (openModal) openModal.classList.add('hidden');
        const actionsEl = document.getElementById('response-actions');
        if (actionsEl) actionsEl.innerHTML = '';
        this._responding = false;
        this._awaitingResponse = false;
      }
      if (deferResolve) {
        this.promptForResponse(player, card, viable);
      }
    }
    return true;
  }

  promptForResponse(caster, card, viable) {
    if (this.gameOver) return;
    const modal = document.getElementById('response-modal');
    if (!modal) {
      // No UI to show the window — cannot leave the deferred card unresolved.
      this._awaitingResponse = false;
      this.resolveStack();
      return;
    }
    this._responding = true;
    this._awaitingResponse = true;
    const title = document.getElementById('response-subtitle');
    title.textContent = `${caster.name} casts ${card.name}. Respond with an Instant, or decline.`;
    const actionsEl = document.getElementById('response-actions');
    if (actionsEl) actionsEl.innerHTML = '';
    const finish = () => {
      if (actionsEl) actionsEl.innerHTML = '';
      modal.classList.add('hidden');
      this._responding = false;
      this._awaitingResponse = false;
      this.resolveStack();
      this.updateUI();
      if (this.currentPlayer === 1 && !this.gameOver) {
        setTimeout(() => this.runAI(), 400);
      }
    };
    for (const r of viable || []) {
      if (r.kind === 'zone-effect') {
        const btn = document.createElement('button');
        btn.className = 'control-btn';
        btn.textContent = `Recall ${r.card.name} (${r.cost})`;
        btn.onclick = () => { if (r.invoke()) finish(); };
        actionsEl.appendChild(btn);
      }
    }
    modal.classList.remove('hidden');
    modal.querySelector('#response-no-btn').onclick = finish;
  }


  // --- Combat ---
undefineAttacker(player, champion) {
    champion.attacking = false;
    delete this.declaredAttackers[champion.id];
    champion.tapped = false;
    player.attackerIds = player.attackerIds.filter(id => id !== champion.id);
  }



  resolveCombat() {
    const attacker = this.active;
    const defender = this.opponent;

    const attackerChampions = attacker.attackerIds
      .map(id => attacker.battlefield.champions.find(c => c.id === id))
      .filter(Boolean);

    const attackerFirstStrike = [];
    const attackerRegular = [];
    const defenderFirstStrike = [];
    const defenderRegular = [];

    for (const atk of attackerChampions) {
      if (this.championHasKeyword(atk, 'double_strike') || this.championHasKeyword(atk, 'first_strike')) {
        attackerFirstStrike.push(atk);
      } else {
        attackerRegular.push(atk);
      }
    }

    const allBlockerIds = new Set();
    for (const blockers of Object.values(this.declaredBlockers)) {
      for (const bId of blockers) allBlockerIds.add(bId);
    }
    for (const bId of allBlockerIds) {
      const blocker = defender.battlefield.champions.find(c => c.id === bId);
      if (!blocker) continue;
      if (this.championHasKeyword(blocker, 'double_strike') || this.championHasKeyword(blocker, 'first_strike')) {
        defenderFirstStrike.push(blocker);
      } else {
        defenderRegular.push(blocker);
      }
    }

    const effPower = (c) => this.statsInverted ? c.toughness : c.power;
    const effTough = (c) => this.statsInverted ? c.power : c.toughness;
    const reduceFor = (dmg, side) => Math.max(0, dmg - (side.combatDamageReduction || 0));
    const damageStat = (c, amount) => { if (this.statsInverted) c.power -= amount; else c.toughness -= amount; };

    const resolveDamageStep = (attackers, defenders) => {
      for (const atk of attackers) {
        if (effTough(atk) <= 0) continue;
        const blockerIds = this.declaredBlockers[atk.id] || [];
        const blockers = blockerIds
          .map(id => defender.battlefield.champions.find(c => c.id === id))
          .filter(Boolean);

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
            log(`${atk.name} tramples for ${damage} damage!`, 'damage');
          }
        } else {
          const dealt = reduceFor(effPower(atk) * (attacker._doubleDamageActive && atk.color === 'Crimson' ? 2 : 1), defender);
          defender.life -= dealt;
          if (this.championHasKeyword(atk, 'lifelink')) attacker.life += dealt + (attacker._drainHealExtra || 0);
          this.processGameEvent('ON_COMBAT_DAMAGE', { isFace: true, targetOwnerId: this.players.indexOf(defender), amount: dealt });
          log(`${atk.name} deals ${dealt} to ${defender.name}.`, 'damage');
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
    super.destroyChampion(player, champion);
    if (idx === -1) return;
    if (player.exile.includes(champion)) {
      log(`${champion.name} is recalled to exile (Recall ${champion.recallCharges} left).`, 'damage');
    } else {
      log(`${champion.name} is destroyed.`, 'damage');
    }
    bus.emit('championDestroyed', { player, card: champion });
    if (player._returnFirstAllyDeath && player._returnFirstAllyDeathCard === champion) {
      log(`${champion.name} marked for return from first ally death.`, 'play');
    }
  }

  // --- Recall (return from exile at 2x cost) ---
  // --- Ability System ---

  executeAbility(ability, source, player, opponent, context) {
    const enemyChampions = opponent.battlefield.champions;
    const friendlyChampions = player.battlefield.champions;

    switch (ability.effect) {
      // --- Damage Effects ---
      case 'damage_all_enemies': {
        const dmg = ability.value;
        log(`${source.name}: ${ability.name} deals ${dmg} damage to all enemy champions!`, 'play');
        const targets = [...enemyChampions];
        for (const c of targets) {
          c.toughness -= dmg;
          if (c.toughness <= 0) this.destroyChampion(opponent, c);
        }
        break;
      }
      case 'damage_any_target': {
        const dmg = ability.value;
        log(`${source.name}: ${ability.name} deals ${dmg} damage!`, 'play');
        if (ability.target === 'enemy_leader' || ability.target === 'leader') {
          opponent.life -= dmg;
          log(`${opponent.name} takes ${dmg} damage.`, 'damage');
        } else if (context.target && !context.target.isFace) {
          context.target.toughness -= dmg;
          log(`${context.target.name} takes ${dmg} damage.`, 'damage');
          if (context.target.toughness <= 0) this.destroyChampion(opponent, context.target);
        } else if (context.target && context.target.isFace) {
          opponent.life -= dmg;
          log(`${opponent.name} takes ${dmg} damage.`, 'damage');
        } else if (enemyChampions.length > 0) {
          const target = enemyChampions[Math.floor(Math.random() * enemyChampions.length)];
          target.toughness -= dmg;
          log(`${target.name} takes ${dmg} damage.`, 'damage');
          if (target.toughness <= 0) this.destroyChampion(opponent, target);
        } else {
          opponent.life -= dmg;
          log(`${opponent.name} takes ${dmg} damage.`, 'damage');
        }
        break;
      }
      case 'damage_random_enemy': {
        const dmg = ability.value;
        if (enemyChampions.length > 0) {
          const target = enemyChampions[Math.floor(Math.random() * enemyChampions.length)];
          target.toughness -= dmg;
          log(`${source.name}: ${ability.name} deals ${dmg} to ${target.name}.`, 'play');
          if (target.toughness <= 0) this.destroyChampion(opponent, target);
        } else {
          opponent.life -= dmg;
          log(`${source.name}: ${ability.name} deals ${dmg} to ${opponent.name}.`, 'play');
        }
        break;
      }
      case 'damage_two_targets': {
        const dmg = ability.value;
        const targets = [...enemyChampions];
        log(`${source.name}: ${ability.name} deals ${dmg} to two targets!`, 'play');
        for (let i = 0; i < Math.min(2, targets.length); i++) {
          targets[i].toughness -= dmg;
          log(`${targets[i].name} takes ${dmg} damage.`, 'damage');
          if (targets[i].toughness <= 0) this.destroyChampion(opponent, targets[i]);
        }
        if (targets.length === 0) {
          opponent.life -= dmg * 2;
          log(`${opponent.name} takes ${dmg * 2} damage.`, 'damage');
        }
        break;
      }
      case 'damage_all_champions': {
        const dmg = ability.value;
        log(`${source.name}: ${ability.name} deals ${dmg} to ALL champions!`, 'play');
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
          log(`${source.name}: ${ability.name} deals ${dmg} to ${target.name}.`, 'play');
          target.toughness = (target.toughness || 0) - dmg;
          if (target.toughness <= 0) this.destroyRelic(opponent, target);
        }
        break;
      }

      // --- Token/Board Effects ---
      case 'create_token': {
        const count = ability.value;
        const tokenPower = ability.tokenPower || 1;
        const tokenToughness = ability.tokenToughness || 1;
        const tokenName = ability.tokenName || 'Token';
        log(`${source.name}: ${ability.name} creates ${count} ${tokenName}(s)!`, 'play');
        for (let i = 0; i < count; i++) {
          const token = {
            id: Date.now() + i,
            name: tokenName,
            type: 'Champion',
            cost: 0,
            power: tokenPower,
            toughness: tokenToughness,
            color: 'Sunforged',
            abilities: [],
            summoned: false,
            tapped: false,
            isToken: true
          };
          friendlyChampions.push(token);
        }
        break;
      }
      case 'destroy_all_enemies': {
        log(`${source.name}: ${ability.name} destroys all enemy champions!`, 'play');
        const targets = [...enemyChampions];
        for (const c of targets) {
          this.destroyChampion(opponent, c);
        }
        break;
      }
      case 'destroy_weakest_enemy': {
        if (enemyChampions.length > 0) {
          const sorted = [...enemyChampions].sort((a, b) => a.power - b.power);
          const weakest = sorted[0];
          log(`${source.name}: ${ability.name} destroys ${weakest.name}!`, 'play');
          this.destroyChampion(opponent, weakest);
        }
        break;
      }
      case 'destroy_relic': {
        const enemyEnchants = opponent.battlefield.relics;
        const destroyTarget = context.target || enemyEnchants[0];
        if (destroyTarget) {
          log(`${source.name}: ${ability.name} destroys ${destroyTarget.name}!`, 'play');
          this.destroyRelic(opponent, destroyTarget);
        }
        break;
      }
      case 'destroy_omen': {
        const enemyOmens = opponent.battlefield.omens;
        const omenTarget = context.target && opponent.battlefield.omens.includes(context.target) ? context.target : enemyOmens[0];
        if (omenTarget) {
          log(`${source.name}: ${ability.name} destroys hidden omen ${omenTarget.name}!`, 'play');
          this.destroyOmen(opponent, omenTarget);
        }
        break;
      }
      case 'destroy_all': {
        log(`${source.name}: ${ability.name} destroys ALL champions!`, 'play');
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
        log(`${source.name}: ${ability.name} returns ${count} enemy champion(s) to hand!`, 'play');
        for (let i = 0; i < Math.min(count, enemyChampions.length); i++) {
          const target = enemyChampions[0];
          this.bounceToHand(opponent, target);
        }
        break;
      }
      case 'bounce_two_enemies': {
        log(`${source.name}: ${ability.name} returns 2 enemy champions to hand!`, 'play');
        for (let i = 0; i < Math.min(2, enemyChampions.length); i++) {
          const target = enemyChampions[0];
          this.bounceToHand(opponent, target);
        }
        break;
      }
      case 'bounce_relic': {
        const enemyEnchants = opponent.battlefield.relics;
        const bounceTarget = context.target || enemyEnchants[0];
        if (bounceTarget) {
          log(`${source.name}: ${ability.name} bounces ${bounceTarget.name}!`, 'play');
          this.bounceToHand(opponent, bounceTarget);
        }
        break;
      }
      case 'bounce_champion': {
        const bounceTarget = context.target || (enemyChampions.length > 0 ? enemyChampions[Math.floor(Math.random() * enemyChampions.length)] : null);
        if (bounceTarget) {
          log(`${source.name}: ${ability.name} bounces ${bounceTarget.name}!`, 'play');
          this.bounceToHand(opponent, bounceTarget);
        }
        break;
      }

      // --- Card Advantage ---
      case 'draw_cards': {
        const count = ability.value;
        log(`${source.name}: ${ability.name} draws ${count} card(s)!`, 'play');
        for (let i = 0; i < count; i++) {
          this.drawCard(player);
        }
        break;
      }
      case 'return_from_graveyard': {
        const count = ability.value;
        const validCards = player.graveyard.filter(c => c.type === 'Champion');
        log(`${source.name}: ${ability.name} returns ${count} champion(s) from graveyard!`, 'play');
        for (let i = 0; i < Math.min(count, validCards.length); i++) {
          const card = validCards[i];
          const idx = player.graveyard.indexOf(card);
          if (idx !== -1) {
            player.graveyard.splice(idx, 1);
            card.toughness = card.toughness || 1;
            card.summoned = true;
            player.battlefield.champions.push(card);
            log(`${card.name} returns to battlefield.`, 'heal');
          }
        }
        break;
      }
      case 'return_from_exile': {
        const count = ability.value;
        const validCards = player.exile.filter(c => c.type === 'Champion');
        log(`${source.name}: ${ability.name} returns ${count} champion(s) from exile!`, 'heal');
        for (let i = 0; i < Math.min(count, validCards.length); i++) {
          const card = validCards[i];
          const idx = player.exile.indexOf(card);
          if (idx !== -1) {
            player.exile.splice(idx, 1);
            card.toughness = card.toughness || 1;
            card.summoned = true;
            player.battlefield.champions.push(card);
            log(`${card.name} returns to battlefield from exile.`, 'heal');
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

      // --- Life Effects ---
      case 'drain_life': {
        const dmg = ability.value;
        const extraHeal = player._drainHealExtra || 0;
        const drainTarget = context.target || (enemyChampions.length > 0 ? enemyChampions[Math.floor(Math.random() * enemyChampions.length)] : null);
        if (drainTarget && !drainTarget.isFace) {
          drainTarget.toughness -= dmg;
          this.gainLife(player, dmg + extraHeal);
          log(`${source.name}: ${ability.name} drains ${dmg} from ${drainTarget.name}!`, 'heal');
          if (drainTarget.toughness <= 0) this.destroyChampion(opponent, drainTarget);
        } else {
          opponent.life -= dmg;
          this.gainLife(player, dmg + extraHeal);
          log(`${source.name}: ${ability.name} drains ${dmg} from ${opponent.name}!`, 'heal');
        }
        break;
      }
      case 'drain_all_opponents': {
        const dmg = ability.value;
        opponent.life -= dmg;
        this.gainLife(player, dmg);
        log(`${source.name}: ${ability.name} drains ${dmg} from ${opponent.name}!`, 'heal');
        break;
      }

      // --- Tap Effects ---
      case 'tap_enemy_champion': {
        const tapTarget = context.target || enemyChampions.filter(c => !c.tapped)[Math.floor(Math.random() * enemyChampions.filter(c => !c.tapped).length)];
        if (tapTarget) {
          tapTarget.tapped = true;
          log(`${source.name}: ${ability.name} taps ${tapTarget.name}!`, 'play');
        }
        break;
      }

      // --- Sacrifice Effects ---
      case 'sacrifice_then_damage': {
        const dmg = ability.value;
        if (friendlyChampions.includes(source)) {
          log(`${source.name}: ${ability.name} sacrifices itself to deal ${dmg} damage!`, 'play');
          this.destroyChampion(player, source);
          this.processAbilities('on_sacrifice', { player, card: source });
          if (enemyChampions.length > 0) {
            const target = enemyChampions[Math.floor(Math.random() * enemyChampions.length)];
            target.toughness -= dmg;
            log(`${target.name} takes ${dmg} damage.`, 'damage');
            if (target.toughness <= 0) this.destroyChampion(opponent, target);
          } else {
            opponent.life -= dmg;
            log(`${opponent.name} takes ${dmg} damage.`, 'damage');
          }
        }
        break;
      }

      // --- Ramp Effects ---
      case 'ramp_search_land': {
        log(`${source.name}: ${ability.name} searches for a land!`, 'play');
        const landInDeck = player.deck.findIndex(c => c.type === 'Land');
        if (landInDeck !== -1) {
          const land = player.deck.splice(landInDeck, 1)[0];
          player.hand.push(land);
          log(`${land.name} added to hand.`, 'heal');
        } else {
          log('No lands left in deck.', 'info');
        }
        player.deck = shuffle(player.deck);
        log(`${player.name}'s deck shuffled.`, 'info');
        break;
      }
      case 'ramp_extra_land': {
        player.extraLandThisTurn = true;
        log(`${source.name}: ${ability.name} allows an extra land this turn!`, 'play');
        break;
      }

      // --- Purge / Exile Effects ---
      case 'purge_target': {
        const purgeTarget = context.target || (enemyChampions.length > 0 ? enemyChampions[Math.floor(Math.random() * enemyChampions.length)] : null);
        if (purgeTarget && !purgeTarget.isFace) {
          log(`${source.name}: ${ability.name} purges ${purgeTarget.name}!`, 'play');
          this.purgeCard(opponent, purgeTarget);
        } else if (context.target && context.target.isFace) {
          log(`${source.name}: ${ability.name} purges ${opponent.name}!`, 'play');
          opponent.life -= ability.value || 3;
          this.checkWin();
        }
        break;
      }
      case 'purge_weakest': {
        if (enemyChampions.length > 0) {
          const sorted = [...enemyChampions].sort((a, b) => a.power - b.power);
          const weakest = sorted[0];
          log(`${source.name}: ${ability.name} purges ${weakest.name}!`, 'play');
          this.purgeCard(opponent, weakest);
        }
        break;
      }
      case 'purge_all_enemies': {
        log(`${source.name}: ${ability.name} purges all enemy champions!`, 'play');
        const targets = [...enemyChampions];
        for (const c of targets) this.purgeCard(opponent, c);
        break;
      }
      case 'purge_hidden': {
        const hidden = this.hiddenUnits(opponent);
        if (hidden.length > 0) {
          const target = context.target && !context.target.isFace && context.target.faceDown ? context.target : hidden[0];
          log(`${source.name}: ${ability.name} purges hidden unit ${target.name}!`, 'play');
          this.purgeCard(opponent, target);
        }
        break;
      }
      case 'purge_from_graveyard': {
        const count = ability.value || 1;
        const valid = opponent.graveyard.filter(c => c.type === 'Champion');
        log(`${source.name}: ${ability.name} purges ${Math.min(count, valid.length)} champion(s) from graveyard!`, 'play');
        for (let i = 0; i < Math.min(count, valid.length); i++) {
          this.purgeCard(opponent, valid[i]);
        }
        break;
      }
      case 'purge_relic': {
        const target = context.target || (opponent.battlefield.relics.length > 0 ? opponent.battlefield.relics[0] : null);
        if (target) {
          log(`${source.name}: ${ability.name} purges relic ${target.name}!`, 'play');
          this.purgeCard(opponent, target);
        }
        break;
      }

      // --- Reveal Effects ---
      case 'reveal_card': {
        const count = ability.value || 1;
        const reveals = [];
        for (let i = 0; i < Math.min(count, player.hand.length); i++) {
          reveals.push(player.hand[i]);
        }
        log(`${source.name}: ${ability.name} reveals ${reveals.length ? reveals.map(c => c.name).join(', ') : 'nothing'} from hand.`, 'play');
        if (reveals.length > 0) {
          this.processAbilities('on_reveal', { player, card: source, _revealedCard: reveals[0] });
        }
        break;
      }
      case 'reveal_top_deck': {
        const count = ability.value || 1;
        const reveals = player.deck.slice(0, count);
        log(`${source.name}: ${ability.name} reveals ${reveals.length ? reveals.map(c => c.name).join(', ') : 'nothing'} from the top of the deck.`, 'play');
        if (reveals.length > 0) {
          this.processAbilities('on_reveal', { player, card: source, _revealedCard: reveals[0] });
        }
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
        const count = ability.value || 1;
        const scried = player.deck.slice(0, count);
        log(`${source.name}: ${ability.name} looks at top ${count} card(s) of deck: ${scried.length ? scried.map(c => c.name).join(', ') : 'none'}.`, 'play');
        player.scryList = scried.map(c => c.id);
        break;
      }

      // --- Discard Effects ---
      case 'draw_then_discard': {
        this.drawCard(player);
        if (player.hand.length > 0) {
          const disc = player.hand[Math.floor(Math.random() * player.hand.length)];
          const idx = player.hand.indexOf(disc);
          player.hand.splice(idx, 1);
          player.graveyard.push(disc);
          log(`${source.name}: ${ability.name} — ${player.name} draws a card then discards ${disc.name}.`, 'play');
          this.processAbilities('on_discard', { player, card: disc });
        }
        break;
      }
      case 'draw_two_discard_one': {
        this.drawCard(player);
        this.drawCard(player);
        if (player.hand.length > 0) {
          const disc = player.hand[Math.floor(Math.random() * player.hand.length)];
          const idx = player.hand.indexOf(disc);
          player.hand.splice(idx, 1);
          player.graveyard.push(disc);
          log(`${source.name}: ${ability.name} — ${player.name} draws two then discards ${disc.name}.`, 'play');
          this.processAbilities('on_discard', { player, card: disc });
        }
        break;
      }
      case 'discard_opponent': {
        const count = ability.value || 1;
        for (let i = 0; i < count; i++) {
          if (opponent.hand.length > 0) {
            const disc = opponent.hand[Math.floor(Math.random() * opponent.hand.length)];
            const idx = opponent.hand.indexOf(disc);
            opponent.hand.splice(idx, 1);
            opponent.graveyard.push(disc);
            log(`${source.name}: ${ability.name} makes ${opponent.name} discard ${disc.name}.`, 'play');
            this.processAbilities('on_discard', { player: opponent, card: disc });
          }
        }
        break;
      }
      case 'draw_then_discard_gain_life': {
        const before = player.hand.length;
        this.drawCard(player);
        if (player.hand.length > 0) {
          const disc = player.hand[Math.floor(Math.random() * player.hand.length)];
          const idx = player.hand.indexOf(disc);
          player.hand.splice(idx, 1);
          player.graveyard.push(disc);
          log(`${source.name}: ${ability.name} — ${player.name} draws then discards ${disc.name}.`, 'play');
          this.processAbilities('on_discard', { player, card: disc });
        }
        if (before > 0 && this.totalCostValue(player.graveyard[player.graveyard.length - 1].cost) >= (ability.value || 4)) {
          this.gainLife(player, 1);
          log(`${source.name}: ${ability.name} gains 1 life from the discarded card.`, 'heal');
        }
        break;
      }

      // --- Ready (Untap) Effects ---
      case 'ready_champion': {
        const readyTarget = context.target || (friendlyChampions.filter(c => c.tapped).length > 0 ? friendlyChampions.filter(c => c.tapped)[0] : friendlyChampions[0]);
        if (readyTarget) {
          readyTarget.tapped = false;
          log(`${source.name}: ${ability.name} readies ${readyTarget.name}!`, 'play');
        }
        break;
      }
      case 'ready_two_champions': {
        const targets = friendlyChampions.filter(c => c.tapped).slice(0, 2);
        const any = targets.length ? targets : friendlyChampions.slice(0, 2);
        for (const c of any) {
          c.tapped = false;
          c.power += ability.value || 0;
          log(`${source.name}: ${ability.name} readies ${c.name} (+${ability.value||0}/+0).`, 'play');
        }
        break;
      }
      case 'ready_all_champions': {
        for (const c of friendlyChampions) {
          c.tapped = false;
        }
        log(`${source.name}: ${ability.name} readies all your champions!`, 'play');
        break;
      }

      // --- Cost Modification Effects ---
      case 'next_card_costs_less': {
        const v = ability.value || 1;
        player.costDiscount += v;
        player.costDiscountUses = 1;
        log(`${source.name}: ${ability.name} — next card costs ${v} less!`, 'play');
        break;
      }
      case 'next_two_cards_cost_less': {
        const v = ability.value || 1;
        player.costDiscount += v;
        player.costDiscountUses = 2;
        log(`${source.name}: ${ability.name} — next two cards cost ${v} less!`, 'play');
        break;
      }
      case 'next_opponent_card_costs_more': {
        const v = ability.value || 1;
        opponent.costTax += v;
        log(`${source.name}: ${ability.name} — opponent's next card costs ${v} more!`, 'play');
        break;
      }

      // --- Hidden Targeting Effects ---
      case 'damage_hidden': {
        const dmg = ability.value;
        const hidden = this.hiddenUnits(opponent);
        if (hidden.length > 0) {
          const target = hidden[Math.floor(Math.random() * hidden.length)];
          target.toughness = (target.toughness || 1) - dmg;
          log(`${source.name}: ${ability.name} deals ${dmg} to hidden unit ${target.name}.`, 'play');
          if (target.toughness <= 0) this.purgeCard(opponent, target);
        } else {
          opponent.life -= dmg;
          log(`${source.name}: ${ability.name} deals ${dmg} to ${opponent.name} (no hidden units).`, 'play');
        }
        break;
      }

      // --- Buff / Pump Effects ---
      case 'grant_swiftstrike_ally': {
        const grantTarget = context.target && !context.target.isFace ? context.target : (friendlyChampions.length ? friendlyChampions[0] : null);
        if (grantTarget && friendlyChampions.includes(grantTarget)) {
          grantTarget.abilities = grantTarget.abilities || [];
          grantTarget.abilities.push({ name: 'Granted Swiftstrike', trigger: 'static', effect: 'haste', _temp: true });
          log(`${source.name}: ${ability.name} grants Swiftstrike to ${grantTarget.name} until end of turn.`, 'play');
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
        log(`${source.name}: ${ability.name} gives Crimson allies +${v} attack until end of turn.`, 'play');
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
          log(`${source.name}: ${ability.name} pumps ${pumpTarget.name} +${v}/+${v} until end of turn.`, 'play');
        }
        break;
      }
      case 'pump_self_stats': {
        if (friendlyChampions.includes(source)) {
          source.power += ability.value;
          source.toughness += ability.value;
          log(`${source.name}: ${ability.name} permanently gains +${ability.value}/+${ability.value}.`, 'play');
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
          log(`${source.name}: ${ability.name} sacrifices ${sac.name} to draw ${count} card(s).`, 'play');
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
        log(`${source.name}: ${ability.name} gives allies +0/+${v} until end of turn.`, 'play');
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
        log(`${source.name}: ${ability.name} gives all allies +${v}/+${v} until end of turn.`, 'play');
        break;
      }
      case 'double_fire_damage': {
        player._doubleDamageActive = true;
        log(`${source.name}: ${ability.name} doubles your fire damage until end of turn.`, 'play');
        break;
      }
      case 'recall_cost_less': {
        player.recallDiscount = (player.recallDiscount || 0) + (ability.value || 1);
        log(`${source.name}: ${ability.name} reduces your recall costs by ${ability.value || 1}.`, 'play');
        break;
      }

      // --- New 120-Card Set Effects ---
      case 'each_player_lose_1': {
        const dmg = ability.value || 1;
        this.me.life -= dmg;
        this.ai.life -= dmg;
        log(`${source.name}: ${ability.name} deals ${dmg} to each player!`, 'play');
        this.checkWin();
        break;
      }
      case 'drain_heal_extra': {
        player._drainHealExtra = (player._drainHealExtra || 0) + (ability.value || 1);
        break;
      }
      case 'first_ally_dies_return_hand': {
        if (!player._firstAllyDiedReturned) {
          player._returnFirstAllyDeath = true;
        }
        break;
      }
      case 'omen_return_ally_with_1_life': {
        player._returnFirstAllyDeath = true;
        player._returnFirstAllyDeathCard = null;
        log(`${source.name}: ${ability.name} — tracking first ally death for return.`, 'play');
        break;
      }
      case 'stat_change_target': {
        const atk = ability.attackDelta || 0;
        const life = ability.lifeDelta || 0;
        let target = context.target || (enemyChampions.length > 0 ? enemyChampions[Math.floor(Math.random() * enemyChampions.length)] : null);
        if (target) {
          if (atk !== 0) { target.power += atk; target._eotPower = (target._eotPower || 0) + atk; }
          if (life !== 0) { target.toughness += life; target._eotToughness = (target._eotToughness || 0) + life; }
          log(`${source.name}: ${ability.name} changes ${target.name} by ${atk}/+${life}.`, 'play');
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
        log(`${source.name}: ${ability.name} grants guard.`, 'play');
        break;
      }
      case 'gain_life': {
        const amt = ability.value || 1;
        this.gainLife(player, amt);
        log(`${source.name}: ${ability.name} gains ${amt} life.`, 'play');
        break;
      }
      case 'grant_guard_self_if_two_plus_attack': {
        const attackers = player.attackerIds.length;
        if (attackers >= 2) {
          const sourceCard = player.battlefield.champions.find(c => c.id === source.id || c === source) || source;
          this.addTemporaryGuard(sourceCard, 1);
          log(`${source.name}: ${ability.name} grants Guard (attacked with ${attackers} allies).`, 'play');
        }
        break;
      }
      case 'grant_guard_all_champions': {
        for (const c of friendlyChampions) {
          this.addTemporaryGuard(c, 1);
        }
        log(`${source.name}: ${ability.name} grants Guard to all champions.`, 'play');
        break;
      }
      case 'next_decree_triggers_twice': {
        player._nextDecreeTriggersTwice = true;
        log(`${source.name}: ${ability.name} — next Decree triggers twice!`, 'play');
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
        log(`${source.name}: ${ability.name} — ready to choose!`, 'play');
        break;
      }
      case 'choose_faction_conditional_attack': {
        const chosenFaction = context.chosenFaction || null;
        if (chosenFaction) {
          source._chosenFaction = chosenFaction;
          source._factionPump = (source._factionPump || 0) + (ability.value || 1);
          log(`${source.name}: ${ability.name} chose ${chosenFaction}, +${ability.value || 1} attack.`, 'play');
        }
        break;
      }
    }

    this.checkWin();
    this.updateUI();
  }

  // --- Keyword System ---


  destroyRelic(player, relic) {
    const idx = player.battlefield.relics.indexOf(relic);
    super.destroyRelic(player, relic);
    if (idx !== -1) log(`${relic.name} is destroyed.`, 'damage');
  }

  destroyDomain(player, domain) {
    const idx = player.battlefield.domains.indexOf(domain);
    super.destroyDomain(player, domain);
    if (idx !== -1) log(`${domain.name} is destroyed.`, 'damage');
  }

  destroyOmen(player, omen) {
    const idx = player.battlefield.omens.indexOf(omen);
    super.destroyOmen(player, omen);
    if (idx !== -1) log(`${omen.name} is destroyed.`, 'damage');
  }


  // --- Phase Management ---

  enterCombat() {
    super.enterCombat();
    this.showCombatBanner('Declare Attackers!', 'declare-attackers');
  }

  showCombatBanner(text, cls) {
    const el = document.getElementById('combat-banner');
    el.className = cls;
    el.textContent = text;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setTimeout(() => { el.className = 'hidden'; }, 1800);
  }
  playerAssignBlockersUI() {
    const attacker = this.ai;
    const defenders = this.me.battlefield.champions.filter(c => !c.tapped && !c.attacking);
    
    // Show blocker selection screen
    const blockerScreen = document.getElementById('blocker-screen');
    if (!blockerScreen) return;
    
    blockerScreen.classList.remove('hidden');
    document.getElementById('blocker-attacker').textContent = 
      `Block attackers for ${attacker.name}`;
    
    const defenderEl = document.getElementById('blocker-defenders');
    defenderEl.innerHTML = '';
    
    // Group defenders by attacker they can block
    for (const atk of attacker.battlefield.champions.filter(c => c.attacking)) {
      const validBlockers = defenders.filter(b =>
        this.canBlock(atk, b, attacker) &&
        this.getCurrentBlockCount(b.id) < this.getMaxBlocks(b)
      );
      
      if (validBlockers.length > 0) {
        const attackerEl = document.createElement('div');
        attackerEl.className = 'attacker-block-group';
        attackerEl.innerHTML = `<strong>${atk.name}</strong> (${atk.power}/${atk.toughness})`;
        
        const blockersEl = document.createElement('div');
        blockersEl.className = 'defender-blocks';
        validBlockers.forEach(b => {
          const cardEl = document.createElement('div');
          cardEl.className = 'card';
          cardEl.dataset.id = b.id;
          cardEl.textContent = `${b.name}\n${b.power}/${b.toughness}`;
          cardEl.style.cursor = 'pointer';
          cardEl.style.background = '#1a1a2e';
          cardEl.style.color = '#f0c040';
          cardEl.style.padding = '4px';
          cardEl.style.borderRadius = '3px';
          cardEl.addEventListener('click', () => {
            // Toggle block assignment
            if (cardEl.classList.contains('selected')) {
              cardEl.classList.remove('selected');
              this.removeBlocker(atk.id, b.id);
            } else {
              // Remove previous selection for this attacker
              defenderEl.querySelectorAll('.defender-blocks .card.selected')
                .forEach(el => el.classList.remove('selected'));
              cardEl.classList.add('selected');
              this.assignBlocker(atk.id, b.id);
            }
          });
          blockersEl.appendChild(cardEl);
        });
        attackerEl.appendChild(blockersEl);
defenderEl.appendChild(attackerEl);
    }
  }
  
  document.getElementById('blocker-done-btn').onclick = () => {
    blockerScreen.classList.add('hidden');
    this.confirmBlockers();
  };
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
        log(`${p.name} draws a card.`, 'info');
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
    if (this.currentPlayer === 1 && !this.gameOver) {
      setTimeout(() => this.runAI(), 600);
    }
  }

  checkWin() {
    if (this.gameOver) return;
    super.checkWin();
    if (this.me.life <= 0) log('You lose!', 'damage');
    else if (this.ai.life <= 0) log('You win!', 'heal');
    if (this.gameOver) this.showEndGameModal();
  }

  concede() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.winner = 1;
    log('You conceded.', 'damage');
    this.showEndGameModal();
  }

  showEndGameModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('end-game-modal');
    if (!modal) return;
    const title = document.getElementById('end-game-title');
    const subtitle = document.getElementById('end-game-subtitle');
    const won = this.winner === 0;
    title.textContent = won ? 'Victory!' : 'Defeat';
    subtitle.textContent = won
      ? `You defeated the AI in ${this.turnNumber} turn${this.turnNumber === 1 ? '' : 's'}.`
      : `The AI defeated you in ${this.turnNumber} turn${this.turnNumber === 1 ? '' : 's'}.`;
    modal.classList.remove('hidden');
  }

  // --- UI Update ---
  updateUI() {
    try {
    // Life
    document.getElementById('player-life').textContent = this.me.life;
    document.getElementById('ai-life').textContent = this.ai.life;

    // Deck counts + hand size
    const playerHandSize = this.me.hand.length;
    const aiHandSize = this.ai.hand.length;
    document.getElementById('player-deck-count').textContent = `Deck: ${this.me.deck.length} | Hand: ${playerHandSize}`;
    document.getElementById('ai-deck-count').textContent = `Deck: ${this.ai.deck.length} | Hand: ${aiHandSize}`;

    // Mana pools
    this.renderManaPool('player-mana', this.me);
    this.renderManaPool('ai-mana', this.ai);

    // Phase indicator
    document.querySelectorAll('.phase').forEach(el => {
      el.classList.toggle('active', el.dataset.phase === this.phase);
    });
    document.getElementById('turn-player').textContent =
      this.currentPlayer === 0 ? "Player's Turn" : "Opponent's Turn";
    document.getElementById('turn-number').textContent = `Turn ${this.turnNumber}`;

    // Battlefield
    this.renderBattlefield('player', this.me);
    this.renderBattlefield('ai', this.ai);

    // Hands
    this.renderHand('player', this.me);
    this.renderHand('ai', this.ai);

    // Grave + Exile stacks
    this.renderZoneStacks('player', this.me);
    this.renderZoneStacks('ai', this.ai);

    // Buttons
    const isPlayerTurn = this.currentPlayer === 0 && !this.gameOver;
    document.getElementById('btn-next-phase').disabled = !isPlayerTurn;
    document.getElementById('btn-end-turn').disabled = !isPlayerTurn;

    const btnAttack = document.getElementById('btn-attack');
    const btnConfirm = document.getElementById('btn-confirm');

    if (this.phase === 'combat' && this.combatStep === 'declare_attackers' && isPlayerTurn) {
      const hasEligible = this.me.battlefield.champions.some(c => !c.tapped && (!c.summoned || this.championHasKeyword(c, 'haste')));
      const hasDeclared = this.me.attackerIds.length > 0;
      btnAttack.classList.toggle('hidden', !hasEligible && !hasDeclared);
      btnAttack.textContent = hasDeclared ? 'Confirm Attack' : 'Declare Attackers';
      btnConfirm.classList.add('hidden');
    } else if (this.phase === 'combat' && this.combatStep === 'declare_blockers') {
      btnAttack.classList.add('hidden');
      btnConfirm.classList.remove('hidden');
      btnConfirm.textContent = 'Confirm Blockers';
    } else {
      btnAttack.classList.toggle('hidden',
        !isPlayerTurn || this.phase !== 'combat' || this.me.battlefield.champions.every(c => c.summoned || c.tapped));
      btnConfirm.classList.add('hidden');
    }

    if (this.phase !== 'combat') {
      btnAttack.classList.add('hidden');
      btnConfirm.classList.add('hidden');
    }
    } catch(e) { console.error('updateUI error:', e); }
  }

  renderManaPool(elementId, player) {
    const el = document.getElementById(elementId);
    el.innerHTML = '';
    const total = player.battlefield.lands.length;
    const untapped = player.battlefield.lands.filter(l => !l.tapped).length;
    for (let i = 0; i < total; i++) {
      const orb = document.createElement('div');
      orb.className = `mana-orb ${i < untapped ? 'filled' : 'empty'}`;
      const land = player.battlefield.lands[i];
      orb.dataset.color = land ? land.color : 'Colorless';
      el.appendChild(orb);
    }
  }

  renderBattlefield(who, player) {
    const prefix = who === 'player' ? 'player' : 'ai';
    const championsRow = document.querySelector(`#${prefix}-champions .card-row`);
    const relicsRow = document.querySelector(`#${prefix}-relics .card-row`);
    const domainsRow = document.querySelector(`#${prefix}-domains .card-row`);
    const omensRow = document.querySelector(`#${prefix}-omens .card-row`);
    const landsRow = document.querySelector(`#${prefix}-lands .card-row`);
    championsRow.innerHTML = '';
    relicsRow.innerHTML = '';
    domainsRow.innerHTML = '';
    omensRow.innerHTML = '';
    landsRow.innerHTML = '';

    player.battlefield.champions.forEach(c => {
      const isAttacking = this.declaredAttackers[c.id];
      const isBlocking = Object.values(this.declaredBlockers).some(blockers => blockers.includes(c.id));
      const node = CardRenderer.create(c, { tapped: c.tapped });

      if (isAttacking) {
        node.classList.add('attacking');
        if (this.phase === 'combat' && this.combatStep === 'declare_attackers' && this.currentPlayer === 0) {
          node.classList.add('selectable');
          node.addEventListener('click', () => {
            this.undefineAttacker(this.me, c);
            this.updateUI();
          }, { once: true });
        }
      }

      if (isBlocking) {
        node.classList.add('blocking');
      }

      if (this.phase === 'combat' && this.combatStep === 'declare_attackers' && this.currentPlayer === 0 && !isAttacking) {
        const hasHaste = this.championHasKeyword(c, 'haste');
        if (!c.tapped && (!c.summoned || hasHaste)) {
          node.classList.add('selectable');
          node.addEventListener('click', () => {
            const idx = this.me.battlefield.champions.indexOf(c);
            if (idx !== -1) this.declareAttacker(this.me, idx);
          }, { once: true });
        }
      }

      if (this.phase === 'combat' && this.combatStep === 'declare_blockers' && this.currentPlayer === 0 && !c.tapped) {
        const attackers = this.ai.battlefield.champions.filter(a => a.attacking);
        for (const atk of attackers) {
          if (this.canBlock(atk, c, this.ai) && (!this.declaredBlockers[atk.id] || !this.declaredBlockers[atk.id].includes(c.id))) {
            node.classList.add('selectable');
            node.addEventListener('click', () => {
              if (this.declaredBlockers[atk.id] && this.declaredBlockers[atk.id].includes(c.id)) {
                this.removeBlocker(atk.id, c.id);
              } else {
                this.assignBlocker(atk.id, c.id);
              }
              this.updateUI();
            }, { once: true });
            break;
          }
        }
      }

      championsRow.appendChild(node);
      node.addEventListener('contextmenu', (e) => { e.preventDefault(); this.showCardModal(c); });
      this.setupLongPress(node, c);
    });

    player.battlefield.relics.forEach(e => {
      const node = CardRenderer.create(e);
      node.addEventListener('contextmenu', (e2) => { e2.preventDefault(); this.showCardModal(e); });
      this.setupLongPress(node, e);
      relicsRow.appendChild(node);
    });

    player.battlefield.omens.forEach(o => {
      const node = CardRenderer.create(o, { faceDown: o.faceDown });
      node.addEventListener('contextmenu', (e2) => { e2.preventDefault(); this.showCardModal(o); });
      this.setupLongPress(node, o);
      omensRow.appendChild(node);
    });

    player.battlefield.domains.forEach(d => {
      const node = CardRenderer.create(d, { scope: 'global' });
      node.classList.add('domain-card');
      node.addEventListener('contextmenu', (e2) => { e2.preventDefault(); this.showCardModal(d); });
      this.setupLongPress(node, d);
      domainsRow.appendChild(node);
    });

    const landGroups = {};
    const landOrder = [];
    player.battlefield.lands.forEach(l => {
      const key = l.name;
      if (!landGroups[key]) { landGroups[key] = []; landOrder.push(key); }
      landGroups[key].push(l);
    });
    landOrder.forEach(name => {
      const lands = landGroups[name];
      while (lands.length > 0) {
        const stack = lands.splice(0, 5);
        const top = stack[0];
        const node = CardRenderer.create(top, { tapped: top.tapped });
        node.addEventListener('contextmenu', (e2) => { e2.preventDefault(); this.showCardModal(top); });
        this.setupLongPress(node, top);
        if (stack.length > 1) {
          const counter = document.createElement('span');
          counter.className = 'land-stack-count';
          counter.textContent = stack.length;
          node.appendChild(counter);
          node.classList.add('land-stack');
        }
        landsRow.appendChild(node);
      }
    });
  }

  createConfirmButton() {
    return document.getElementById('btn-confirm');
  }

  renderHand(who, player) {
    const el = document.getElementById(`${who}-hand`);
    el.innerHTML = '';
    const isPlayer = who === 'player';
    player.hand.forEach((card, i) => {
      const faceDown = !isPlayer;
      const canPlay = isPlayer && !this.gameOver && this.currentPlayer === 0;
      const node = CardRenderer.create(card, { faceDown });
      if (isPlayer) {
        node.addEventListener('click', () => this.onCardClick(i, card));
        node.addEventListener('contextmenu', (e) => { e.preventDefault(); this.showCardModal(card); });
        this.setupLongPress(node, card);
      }
      el.appendChild(node);
    });
  }

  renderZoneStacks(who, player) {
    const fill = (elementId, zoneCards, recallable) => {
      const el = document.getElementById(elementId);
      if (!el) return;
      const stackEl = el.querySelector('.zone-stack-cards');
      if (!stackEl) return;
      stackEl.innerHTML = '';
      if (zoneCards.length === 0) return;
      const top = zoneCards[zoneCards.length - 1];
      const node = CardRenderer.create(top, {});
      node.addEventListener('contextmenu', (e2) => { e2.preventDefault(); this.showCardModal(top); });
      this.setupLongPress(node, top);
      node.classList.add('zone-stack-card');
      if (recallable) {
        node.classList.add('recallable');
        node.title = `Pay ${this.recallCost(top, this.me)} to return ${top.name} from exile to the battlefield.`;
        node.addEventListener('click', () => {
          if (this.activateRecall(this.me, top)) this.updateUI();
        });
      }
      if (zoneCards.length > 1) {
        const counter = document.createElement('span');
        counter.className = 'land-stack-count';
        counter.textContent = zoneCards.length;
        node.appendChild(counter);
      }
      stackEl.appendChild(node);
    };
    fill(`${who}-graveyard`, player.graveyard);
    const canRecall = who === 'player' && this.currentPlayer === 0 && !this.gameOver &&
      ['main1', 'main2'].includes(this.phase);
    const top = player.exile[player.exile.length - 1];
    fill(`${who}-exile`, player.exile, canRecall && top && top.type === 'Champion' &&
      this.championHasKeyword(top, 'recall') && (top.recallCharges || 0) > 0);
  }

  // --- Card Interaction ---
  onCardClick(index, card) {
    if (this.gameOver) return;
    if (this.currentPlayer !== 0 && !this._responding) return;
    debug(`onCardClick: ${card.name} (${card.type}) index=${index}`);

    try {
      if (card.type === 'Land') {
        if (this.currentPlayer !== 0) return;
        this.playLand(this.me, index);
      } else if (card.type === 'Champion' && this.canPayCost(this.me, this.effectiveCost(this.me, card.cost))) {
        if (this.currentPlayer !== 0) return;
        this.playChampion(this.me, index);
      } else if (card.type === 'Relic' && this.canPayCost(this.me, this.effectiveCost(this.me, card.cost))) {
        if (this.currentPlayer !== 0) return;
        this.playRelic(this.me, index);
      } else if (card.type === 'Domain' && this.canPayCost(this.me, this.effectiveCost(this.me, card.cost))) {
        if (this.currentPlayer !== 0) return;
        this.playDomain(this.me, index);
      } else if (card.type === 'Omen' && this.canPayCost(this.me, this.effectiveCost(this.me, card.cost))) {
        if (this.currentPlayer !== 0) return;
        this.playOmen(this.me, index);
      } else if ((card.type === 'Spell' || card.type === 'Instant' || card.type === 'Decree') && this.canPayCost(this.me, this.effectiveCost(this.me, card.cost))) {
        if (this.currentPlayer !== 0 && card.type !== 'Instant') return;
        this.handlePlayerSpell(index, card);
      } else {
        log(`Can't play ${card.name} - not enough mana.`, 'info');
      }
    } catch(e) {
      console.error('Error in onCardClick:', e);
    }
  }

  handlePlayerSpell(index, card) {
    if (!this.spellNeedsTarget(card)) {
      this.playSpell(this.me, index, null);
      this.resolveStack();
      return;
    }
    const targets = this.getSpellTargets(card);
    if (targets.length === 0) {
      this.playSpell(this.me, index, null);
      return;
    }
    this.pendingAbility = { type: 'spell_target', index, card };
    log(`Click a target for ${card.name} (or Cancel).`, 'info');
    this.renderTargetable(targets);
    this.showCancelButton();
  }

  spellNeedsTarget(card) {
    if (!card.abilities || card.abilities.length === 0) return false;
    return card.abilities.some(a => {
      if (typeof a !== 'object' || a.trigger !== 'on_cast') return false;
      return ['damage_any_target','bounce_champion','tap_enemy_champion',
              'drain_life','destroy_relic','bounce_relic',
              'damage_relic'].includes(a.effect);
    });
  }

  getSpellTargets(card) {
    if (!card.abilities || card.abilities.length === 0) return [];
    const targetedAbility = card.abilities.find(a => {
      if (typeof a !== 'object' || a.trigger !== 'on_cast') return false;
      return ['damage_any_target','bounce_champion','tap_enemy_champion',
              'drain_life','destroy_relic','bounce_relic',
              'damage_relic'].includes(a.effect);
    });
    if (!targetedAbility) return [];
    const e = targetedAbility.effect;
    if (e === 'destroy_relic' || e === 'bounce_relic' || e === 'damage_relic') {
      return [...this.ai.battlefield.relics];
    }
    const targets = [...this.ai.battlefield.champions];
    if (e === 'damage_any_target') {
      targets.push({ id: 'ai-face', name: this.ai.name + ' (Life)', isFace: true });
    }
    return targets;
  }

  showCancelButton() {
    const btn = document.getElementById('btn-confirm');
    btn.classList.remove('hidden');
    btn.textContent = 'Cancel';
    btn.onclick = () => this.cancelSpellTarget();
  }

  cancelSpellTarget() {
    document.querySelectorAll('.card').forEach(el => el.classList.remove('targetable'));
    const faceEl = document.querySelector('.ai-face-target');
    if (faceEl) faceEl.classList.remove('targetable');
    this.pendingAbility = null;
    const btn = document.getElementById('btn-confirm');
    btn.classList.add('hidden');
    btn.textContent = 'Confirm';
    btn.onclick = () => { if (game && game.combatStep === 'declare_blockers') game.confirmBlockers(); };
    log('Spell cancelled.', 'info');
  }

  renderTargetable(targets) {
    document.querySelectorAll('.card').forEach(el => el.classList.remove('targetable'));
    document.querySelectorAll('.ai-face-target').forEach(el => el.classList.remove('targetable'));
    for (const t of targets) {
      if (t.isFace) {
        const el = document.getElementById('ai-life');
        if (el) {
          el.closest('.zone-header').classList.add('targetable');
          el.closest('.zone-header').style.cursor = 'crosshair';
          el.closest('.zone-header').addEventListener('click', () => this.onTargetSelected(t), { once: true });
        }
      } else {
        const el = document.querySelector(`#ai-champions .card[data-id="${t.id}"], #ai-relics .card[data-id="${t.id}"]`);
        if (el) {
          el.classList.add('targetable');
          el.addEventListener('click', () => this.onTargetSelected(t), { once: true });
        }
      }
    }
  }

  onTargetSelected(target) {
    document.querySelectorAll('.card').forEach(el => el.classList.remove('targetable'));
    document.querySelectorAll('.targetable').forEach(el => {
      el.classList.remove('targetable');
      el.style.cursor = '';
    });
    if (!this.pendingAbility) return;
    const { index, card } = this.pendingAbility;
    this.pendingAbility = null;
    const btn = document.getElementById('btn-confirm');
    btn.classList.add('hidden');
    btn.textContent = 'Confirm';
    btn.onclick = () => { if (game && game.combatStep === 'declare_blockers') game.confirmBlockers(); };

    if (card.type === 'Spell' || card.type === 'Instant') {
      this.playSpell(this.me, index, target);
      this.resolveStack();
    }
  }

  showCardModal(card) {
    const modal = document.getElementById('card-modal');
    const content = document.getElementById('card-modal-content');
    content.innerHTML = '';
    content.appendChild(CardRenderer.create(card));
    modal.classList.remove('hidden');
  }

  setupLongPress(node, card) {
    let timer = null;
    const start = () => { timer = setTimeout(() => this.showCardModal(card), 400); };
    const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
    node.addEventListener('touchstart', start, { passive: true });
    node.addEventListener('touchend', cancel);
    node.addEventListener('touchmove', cancel);
    node.addEventListener('mousedown', (e) => { if (e.button === 0) start(); });
    node.addEventListener('mouseup', cancel);
    node.addEventListener('mouseleave', cancel);
  }

  // --- AI ---
  runAI() {
    if (this.gameOver || this.currentPlayer !== 1) return;
    const ai = this.ai;

    switch (this.phase) {
      case 'untap':
        this.phase = 'draw';
        this.drawCard(ai);
        log(`${ai.name} draws a card.`, 'info');
        this.updateUI();
        setTimeout(() => this.runAI(), 400);
        return;
      case 'draw':
        this.phase = 'main1';
        this.updateUI();
        setTimeout(() => this.runAI(), 400);
        return;
      case 'main1':
        this.aiMainPhase(ai);
        if (this._awaitingResponse === true) return;
        this.resolveStack();
        this.updateUI();
        setTimeout(() => {
          this.phase = 'combat';
          this.runAI();
        }, 600);
        return;
      case 'combat':
        this.aiCombat(ai);
        this.updateUI();
        if (this.phase === 'main2') {
          setTimeout(() => this.runAI(), 400);
        }
        return;
      case 'main2':
        this.aiMainPhase(ai);
        if (this._awaitingResponse === true) return;
        this.resolveStack();
        this.updateUI();
        setTimeout(() => this.endTurn(), 400);
        return;
    }
    this.updateUI();
  }



}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  const startScreen = document.getElementById('start-screen');
  const gameContainer = document.getElementById('game-container');
  const stepDifficulty = document.getElementById('step-difficulty');
  const stepDeck = document.getElementById('step-deck');
  const deckSelect = document.getElementById('deck-select');
  let game = null;
  let selectedDifficulty = null;
  let selectedFormat = 'Classic';
  let selectedAISpeed = 'normal';
  let deckData = null;

  // Load card database and deck data
  Promise.all([
    fetch('card_database.json').then(r => r.json()),
    fetch('decks.json').then(r => r.json())
  ]).then(([cards, decks]) => {
    window.__CARD_DB__ = cards;
    window.__CARD_MAP__ = new Map(cards.map(c => [c.id, c]));
    deckData = decks;
    window.__DECK_DB__ = decks;
  }).catch(err => console.error('Failed to load data:', err));

  // Difficulty selection
  document.querySelectorAll('#difficulty-select button').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDifficulty = btn.dataset.difficulty;
      stepDifficulty.classList.add('hidden');
      stepDeck.classList.remove('hidden');
      buildDeckOptions();
    });
  });

  // AI Speed selection (POSTPONED until final touches phase)
  /*
  document.querySelectorAll('#ai-speed-select button').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedAISpeed = btn.dataset.speed;
      document.querySelectorAll('#ai-speed-select button')
        .forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });
  */

  document.querySelectorAll('#format-select button').forEach(btn => btn.addEventListener('click', () => {
    selectedFormat = btn.dataset.format;
  }));

  function buildDeckOptions() {
    deckSelect.innerHTML = '';
    const formatDecks = deckData.formats[selectedFormat].decks;
    const factionColors = { Crimson: '#e67e22', Sunforged: '#27ae60', Lantern: '#8e44ad', Gilded: '#2980b9' };
    Object.entries(formatDecks).forEach(([key, deck]) => {
      const opt = document.createElement('div');
      opt.className = 'deck-option';
      opt.style.borderColor = factionColors[deck.faction] || '#f0c040';
      opt.innerHTML = `
        <div class="deck-name">${deck.name}</div>
        <div class="deck-faction" style="color:${factionColors[deck.faction]}">${deck.faction}</div>
        <div class="deck-strategy">${deck.strategy}</div>
      `;
      opt.addEventListener('click', () => startGameWithDeck(key));
      deckSelect.appendChild(opt);
    });
  }

  let pendingDeckKey = null;

  function startGameWithDeck(deckKey) {
    pendingDeckKey = deckKey;
    startScreen.classList.add('hidden');
    showCoinToss();
  }

  function showCoinToss() {
    const coinScreen = document.getElementById('coin-toss-screen');
    coinScreen.classList.remove('hidden');
    const coinDisplay = document.getElementById('coin-display');
    const coinPrompt = document.getElementById('coin-prompt');
    const coinChoices = document.getElementById('coin-choices');
    const coinResult = document.getElementById('coin-result');
    const coinContinue = document.getElementById('coin-continue');
    coinDisplay.textContent = '?';
    coinResult.classList.add('hidden');
    coinContinue.classList.add('hidden');
    coinChoices.classList.remove('hidden');
    coinPrompt.textContent = 'Choose a side:';
    coinPrompt.classList.remove('hidden');

    function doCoinToss(playerCall) {
      coinChoices.classList.add('hidden');
      coinPrompt.classList.add('hidden');
      coinDisplay.classList.add('flipping');
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      setTimeout(() => {
        coinDisplay.classList.remove('flipping');
        coinDisplay.textContent = result === 'heads' ? 'H' : 'T';
        const playerWon = playerCall === result;
        coinResult.classList.remove('hidden');
        if (playerWon) {
          coinResult.textContent = 'You won the toss!';
        } else {
          coinResult.textContent = 'Opponent won the toss.';
        }
        coinContinue.classList.remove('hidden');
        coinContinue.textContent = playerWon ? 'You go first' : 'Opponent goes first';
        coinContinue.addEventListener('click', function handler() {
          coinContinue.removeEventListener('click', handler);
          coinScreen.classList.add('hidden');
          launchGame(playerWon);
        });
      }, 700);
    }

    document.getElementById('coin-heads').onclick = () => doCoinToss('heads');
    document.getElementById('coin-tails').onclick = () => doCoinToss('tails');
  }

  function launchGame(playerFirst) {
    game = new GameState(selectedDifficulty, pendingDeckKey, selectedFormat || 'Classic');
    gameContainer.classList.remove('hidden');
    if (!playerFirst) {
      game.currentPlayer = 1;
    }
    game.startGame();
    window.__game = game;

    showMulligan(() => {
      if (!playerFirst) {
        setTimeout(() => game.runAI(), 600);
      }
    });
  }

  function showMulligan(onDone) {
    const mullScreen = document.getElementById('mulligan-screen');
    if (!mullScreen) { onDone(); return; }
    const keepBtn = document.getElementById('mull-keep-btn');
    const tossBtn = document.getElementById('mull-toss-btn');
    let mullCount = 0;

    function updateMulliganUI() {
      document.getElementById('mull-count').textContent = 'Cards: ' + game.me.hand.length;
      document.getElementById('mull-lands').textContent =
        'Lands: ' + game.me.hand.filter(c => c.type === 'Land').length;
      const preview = document.getElementById('mull-hand-preview');
      preview.innerHTML = '';
      game.me.hand.forEach(card => {
        preview.appendChild(CardRenderer.create(card));
      });
      tossBtn.disabled = game.me.hand.length <= 1;
    }

    keepBtn.onclick = () => {
      mullScreen.classList.add('hidden');
      game._mulliganResolved = true;
      onDone();
    };
    tossBtn.onclick = () => {
      if (game.me.hand.length <= 1) return;
      game.mulligan(game.me);
      mullCount++;
      document.getElementById('mull-title').textContent = 'Mulligan #' + mullCount;
      updateMulliganUI();
    };

    updateMulliganUI();
    mullScreen.classList.remove('hidden');
  }

  // Controls
  document.getElementById('btn-next-phase').addEventListener('click', () => {
    if (game) game.nextPhase();
  });
  document.getElementById('btn-end-turn').addEventListener('click', () => {
    if (game) game.endTurn();
  });
  document.getElementById('btn-confirm').addEventListener('click', () => {
    if (game && game.combatStep === 'declare_blockers') game.confirmBlockers();
  });
  document.getElementById('btn-attack').addEventListener('click', () => {
    if (!game || game.phase !== 'combat' || game.combatStep !== 'declare_attackers') return;
    if (game.currentPlayer !== 0) return;
    game.confirmAttackers();
  });
  document.getElementById('btn-concede').addEventListener('click', () => {
    if (game) game.concede();
  });

  // End-game modal actions
  document.getElementById('end-play-again-btn').addEventListener('click', () => {
    document.getElementById('end-game-modal').classList.add('hidden');
    startGameWithDeck(pendingDeckKey);
  });
  document.getElementById('end-new-game-btn').addEventListener('click', () => {
    document.getElementById('end-game-modal').classList.add('hidden');
    document.getElementById('game-container').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
  });

  // Card modal
  document.getElementById('card-modal-close').addEventListener('click', () => {
    document.getElementById('card-modal').classList.add('hidden');
  });
  document.getElementById('card-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      e.currentTarget.classList.add('hidden');
    }
  });

  // Escape key cancels targeting
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && game && game.pendingAbility) {
      game.cancelSpellTarget();
    }
    if (e.key === ' ' && game && !game.gameOver) { // Space: advance phase
      e.preventDefault();
      game.nextPhase();
    }
    if (e.key === 'Enter' && game && game.currentPlayer === 0 && !game.gameOver) { // Enter: advance phase
      e.preventDefault();
      game.nextPhase();
    }
    if (e.key === 'c' && game) { // C: Concede
      e.preventDefault();
      game.concede();
    }
    if (e.key === 'C' && game) {
      e.preventDefault();
      game.concede();
    }
  });
});
