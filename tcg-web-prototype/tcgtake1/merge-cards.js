#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CARDS_JSON = path.join(ROOT, 'cards.json');
const MAPPED_JSON = path.join(__dirname, 'mapped_cards.json');

const OMEN_FLIP_MAP = {
  on_ally_dies: 'ON_ALLY_DIES',
  end_of_turn: 'END_OF_TURN'
};

function titleCase(s) {
  return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function normalizeAbility(card, ab, index) {
  if (typeof ab === 'string') return ab;
  const clone = Object.assign({}, ab);
  if (!clone.name) {
    const base = card.name + ': ' + titleCase(clone.effect);
    clone.name = index === 0 ? base : base + ' ' + (index + 1);
  }
  return clone;
}

function normalizeOmen(card) {
  const out = Object.assign({}, card);
  out.abilities = (card.abilities || []).map(normalizeAbility.bind(null, card));
  const first = out.abilities.find(a => typeof a === 'object' && a.trigger);
  const trigger = first ? first.trigger : 'static';
  if (trigger === 'static') {
    out.abilities = out.abilities.map(a => {
      if (typeof a === 'object' && a.trigger === 'static') {
        const clone = Object.assign({}, a);
        clone.trigger = 'end_of_turn';
        return clone;
      }
      return a;
    });
    out.flipTrigger = 'END_OF_TURN';
  } else {
    out.flipTrigger = OMEN_FLIP_MAP[trigger] || trigger.toUpperCase();
  }
  return out;
}

function normalizeMapped(card) {
  const out = Object.assign({}, card);
  out.providesMana = out.providesMana === undefined ? null : out.providesMana;
  if (out.type !== 'Champion') {
    if (out.power === undefined) out.power = null;
    if (out.toughness === undefined) out.toughness = null;
  }
  if (out.type === 'Omen') {
    return normalizeOmen(out);
  }
  out.abilities = (out.abilities || []).map(normalizeAbility.bind(null, out));
  return out;
}

const cards = JSON.parse(fs.readFileSync(CARDS_JSON, 'utf8'));
const mapped = JSON.parse(fs.readFileSync(MAPPED_JSON, 'utf8'));

const existingIds = new Set(cards.map(c => c.id));
const existingNames = new Set(cards.map(c => c.name.toLowerCase()));

const idConflicts = mapped.filter(c => existingIds.has(c.id)).map(c => c.id);
if (idConflicts.length) {
  console.error('ABORT: mapped card ids already exist in cards.json:', idConflicts.join(', '));
  process.exit(1);
}
const nameConflicts = mapped.filter(c => existingNames.has(c.name.toLowerCase())).map(c => c.id + ' ' + c.name);
if (nameConflicts.length) {
  console.error('WARN: mapped card names collide with base cards.json:', nameConflicts.join(' | '));
}

const normalized = mapped.map(normalizeMapped);
cards.push(...normalized);

const out = JSON.stringify(cards, null, 2) + '\n';
fs.writeFileSync(CARDS_JSON, out, 'utf8');

const byType = {};
const byRarity = {};
for (const c of normalized) {
  byType[c.type] = (byType[c.type] || 0) + 1;
  byRarity[c.rarity] = (byRarity[c.rarity] || 0) + 1;
}
console.log('Merged ' + normalized.length + ' mapped cards into cards.json (total ' + cards.length + ').');
console.log('  mapped by type:   ' + Object.entries(byType).map(([k, v]) => k + '=' + v).join(', '));
console.log('  mapped by rarity: ' + Object.entries(byRarity).map(([k, v]) => k + '=' + v).join(', '));
const omens = normalized.filter(c => c.type === 'Omen');
console.log('  Omen flipTriggers: ' + omens.map(c => c.id + '=' + c.flipTrigger).join(', '));
