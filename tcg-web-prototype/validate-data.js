#!/usr/bin/env node
/*
 * validate-data.js — Semantic data validation suite (Goal 1)
 * ===========================================================
 * Checks card_database.json and decks.json for structural and semantic
 * correctness that verify.ps1 (build-identity) does not cover.
 *
 * Output style mirrors recall_ominous_test.js: PASS/FAIL per check,
 * summary line, exits non-zero on any failure.
 *
 * Run: node validate-data.js
 *
 * MUST stay green after any change that touches build-cards.js,
 * gen_decks.js, cards.json, or slug_mappings.js.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DIR = __dirname;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('PASS ' + name);
  } else {
    fail++;
    console.log('FAIL ' + name + (detail ? ' — ' + detail : ''));
  }
}

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
const db      = JSON.parse(fs.readFileSync(path.join(DIR, 'card_database.json'), 'utf8'));
const deckDB  = JSON.parse(fs.readFileSync(path.join(DIR, 'decks.json'),         'utf8'));
const SLUGS   = require('./slug_mappings');

const dbMap   = new Map(db.map(c => [c.id, c]));

// Schema enums
const VALID_FACTIONS = ['Crimson', 'Sunforged', 'Lantern', 'Gilded', 'Zealot', 'Colorless'];
const VALID_RARITIES = ['Common', 'Uncommon', 'Rare', 'Legendary', 'Mythic'];
const VALID_TYPES    = ['Land', 'Champion', 'Spell', 'Instant', 'Decree', 'Relic', 'Domain', 'Omen'];

// Standard rarity caps (deck-total)
const STANDARD_CAPS  = { Legendary: 1, Mythic: 2, Rare: 3 };
const CLASSIC_MAXCOPY = 4;

// ---------------------------------------------------------------------------
// BLOCK A — card_database.json composition
// ---------------------------------------------------------------------------
console.log('\n--- A: card_database.json composition ---');

const lands    = db.filter(c => c.type === 'Land');
const nonLands = db.filter(c => c.type !== 'Land');

check('A1 total cards = 480',     db.length === 480,    'got ' + db.length);
check('A2 land count = 100',      lands.length === 100, 'got ' + lands.length);
check('A3 non-land count = 380',  nonLands.length === 380, 'got ' + nonLands.length);

// Lands per faction: 20 each for 5 colored factions, 0 for Colorless
const landsByFaction = {};
VALID_FACTIONS.forEach(f => { landsByFaction[f] = 0; });
lands.forEach(c => { landsByFaction[c.color] = (landsByFaction[c.color] || 0) + 1; });
VALID_FACTIONS.forEach(f => {
  const expected = f === 'Colorless' ? 0 : 20;
  check('A4 lands ' + f + ' = ' + expected,
        landsByFaction[f] === expected,
        'got ' + landsByFaction[f]);
});

// Enum validity
const badFaction = db.filter(c => !VALID_FACTIONS.includes(c.color));
const badRarity  = db.filter(c => !VALID_RARITIES.includes(c.rarity));
const badType    = db.filter(c => !VALID_TYPES.includes(c.type));

check('A5 all cards have valid faction color',
      badFaction.length === 0,
      badFaction.map(c => c.id + ':' + c.color).join(', '));

check('A6 all cards have valid rarity',
      badRarity.length === 0,
      badRarity.map(c => c.id + ':' + c.rarity).join(', '));

check('A7 all cards have valid type',
      badType.length === 0,
      badType.map(c => c.id + ':' + c.type).join(', '));

// Colorless has no colored lands
const colorlessLands = lands.filter(c => c.color === 'Colorless');
check('A8 Colorless has zero lands',
      colorlessLands.length === 0,
      colorlessLands.map(c => c.id + ' ' + c.name).join(', '));

// Rarity distribution sanity (totals from AGENTS.md: C175/U208/R48/M24/L25)
const rc = {};
VALID_RARITIES.forEach(r => { rc[r] = 0; });
db.forEach(c => { rc[c.rarity]++; });
check('A9 Common count = 175',    rc.Common    === 175,  'got ' + rc.Common);
check('A10 Uncommon count = 208', rc.Uncommon  === 208,  'got ' + rc.Uncommon);
check('A11 Rare count = 48',      rc.Rare      === 48,   'got ' + rc.Rare);
check('A12 Mythic count = 24',    rc.Mythic    === 24,   'got ' + rc.Mythic);
check('A13 Legendary count = 25', rc.Legendary === 25,   'got ' + rc.Legendary);

// ---------------------------------------------------------------------------
// BLOCK B — card_database.json: orphan patch check
// (patches referencing trimmed / non-existent ids are dead code but flagged)
// ---------------------------------------------------------------------------
console.log('\n--- B: transformCards() orphan patch audit ---');

const buildSrc = fs.readFileSync(path.join(DIR, 'build-cards.js'), 'utf8');

function extractPatchKeys(src, name) {
  const rx = new RegExp('const ' + name + '\\s*=\\s*\\{([\\s\\S]*?)\\n  \\};');
  const m = src.match(rx);
  if (!m) return [];
  return [...m[1].matchAll(/(\d+):\[/g)].map(mm => parseInt(mm[1]));
}
function extractSetIds(src, name) {
  const m = src.match(new RegExp('const ' + name + '\\s*=\\s*new Set\\(\\[([^\\]]+)\\]\\)'));
  return m ? m[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [];
}
function extractMapKeys(src, name) {
  const m = src.match(new RegExp('const ' + name + '\\s*=\\s*\\{([^}]+)\\}'));
  return m ? [...m[1].matchAll(/(\d+):/g)].map(mm => parseInt(mm[1])) : [];
}

const TRIM_IDS         = extractSetIds(buildSrc, 'TRIM_IDS');
const spellPatchKeys   = extractPatchKeys(buildSrc, 'spellPatch');
const enchantPatchKeys = extractPatchKeys(buildSrc, 'enchantPatch');
const instantPatchKeys = extractPatchKeys(buildSrc, 'instantPatch');
const kwKeys           = extractPatchKeys(buildSrc, 'kw').concat(
  // kw also has entries without brackets (single values) — reparse
  (() => { const m = buildSrc.match(/const kw = \{([\s\S]*?)\n  \};/); return m ? [...m[1].matchAll(/(\d+):\[/g)].map(mm=>parseInt(mm[1])) : []; })()
);
const roKeys           = extractMapKeys(buildSrc, 'rarityOverride');
const lcIds            = extractSetIds(buildSrc, 'legendaryChampionIds');

// Note: TRIM runs BEFORE the patch map(), so patches on trimmed IDs are dead code.
// We flag them as informational orphans; they don't affect correctness.
const trimSet = new Set(TRIM_IDS);

function orphansOf(name, keys) {
  // An orphan is a key that does not exist in the final DB (trimmed or never existed)
  const orphans = keys.filter(id => !dbMap.has(id));
  // Further split: trimmed (was in TRIM_IDS) vs. never existed
  const trimmed   = orphans.filter(id => trimSet.has(id));
  const vanished  = orphans.filter(id => !trimSet.has(id));
  return { orphans, trimmed, vanished };
}

// Vanished orphans (keys referencing IDs that were never in source): real bugs
['spellPatch', 'enchantPatch', 'instantPatch'].forEach(name => {
  const keys = name === 'spellPatch' ? spellPatchKeys
             : name === 'enchantPatch' ? enchantPatchKeys : instantPatchKeys;
  const { vanished, trimmed } = orphansOf(name, keys);
  check('B1.' + name + ' no truly-vanished orphans (not in DB, not trimmed)',
        vanished.length === 0,
        'vanished: ' + vanished.join(', '));
  // Trimmed orphans are dead code — warn but do not fail
  if (trimmed.length > 0) {
    console.log('WARN B1.' + name + ' dead-code patches on trimmed ids (harmless): ' + trimmed.join(', '));
  }
});

// kw keys check
const kwOnly = [...new Set(kwKeys)];
const { vanished: kwVanished, trimmed: kwTrimmed } = orphansOf('kw', kwOnly);
check('B2 kw no vanished orphans', kwVanished.length === 0,
      'vanished: ' + kwVanished.join(', '));
if (kwTrimmed.length > 0) {
  console.log('WARN B2 kw dead-code entries on trimmed ids (harmless): ' + kwTrimmed.join(', '));
}

// rarityOverride check
const { vanished: roVanished, trimmed: roTrimmed } = orphansOf('rarityOverride', roKeys);
check('B3 rarityOverride no vanished orphans', roVanished.length === 0,
      'vanished: ' + roVanished.join(', '));
if (roTrimmed.length > 0) {
  console.log('WARN B3 rarityOverride dead-code on trimmed ids (harmless): ' + roTrimmed.join(', '));
}

// legendaryChampionIds: each id must be in DB and have rarity=Legendary
const lcNotInDB  = lcIds.filter(id => !dbMap.has(id));
const lcNotLeg   = lcIds.filter(id => { const c = dbMap.get(id); return c && c.rarity !== 'Legendary'; });
check('B4 all legendaryChampionIds exist in DB',         lcNotInDB.length  === 0, lcNotInDB.join(', '));
check('B5 all legendaryChampionIds have rarity=Legendary', lcNotLeg.length === 0,
      lcNotLeg.map(id => id + ':' + (dbMap.get(id)||{}).rarity).join(', '));

// legendaryKit keys must be in legendaryChampionIds
const lkMatch = buildSrc.match(/const legendaryKit = \{([\s\S]*?)\n  \};/);
const lkKeys  = lkMatch ? [...lkMatch[1].matchAll(/^\s+(\d+):/gm)].map(m => parseInt(m[1])) : [];
const lcSet   = new Set(lcIds);
const lkExtra = lkKeys.filter(id => !lcSet.has(id));
check('B6 all legendaryKit keys are in legendaryChampionIds', lkExtra.length === 0,
      'extra: ' + lkExtra.join(', '));
const lkMissing = lcIds.filter(id => !new Set(lkKeys).has(id));
check('B7 all legendaryChampionIds have a legendaryKit entry', lkMissing.length === 0,
      'missing kit for: ' + lkMissing.join(', '));

// ---------------------------------------------------------------------------
// BLOCK C — decks.json structure
// ---------------------------------------------------------------------------
console.log('\n--- C: decks.json structure ---');

check('C1 decks.json has formats key', !!deckDB.formats, 'missing formats key');

const formatNames = Object.keys(deckDB.formats || {});
check('C2 exactly 2 formats (Classic, Standard)',
      formatNames.length === 2 && formatNames.includes('Classic') && formatNames.includes('Standard'),
      'got: ' + formatNames.join(', '));

// Valid slugs from slug_mappings
const validSlugs = new Set(Object.values(SLUGS.DECK_SLUGS));

let totalDecks = 0;
for (const [formatName, formatData] of Object.entries(deckDB.formats || {})) {
  const decks    = formatData.decks || {};
  const deckKeys = Object.keys(decks);
  totalDecks += deckKeys.length;

  check('C3.' + formatName + ' has 6 decks', deckKeys.length === 6, 'got ' + deckKeys.length);

  for (const slug of deckKeys) {
    const deck  = decks[slug];
    const cards = deck.cards || [];

    // Expand to individual copies
    let landCount = 0, nonLandCount = 0;
    const badIds     = [];
    const copyCounts = {};
    const rarityCounts = {};
    VALID_RARITIES.forEach(r => { rarityCounts[r] = 0; });

    cards.forEach(entry => {
      const card  = dbMap.get(entry.id);
      const count = entry.count || 0;
      copyCounts[entry.id] = (copyCounts[entry.id] || 0) + count;
      if (!card) { badIds.push(entry.id); return; }
      rarityCounts[card.rarity] = (rarityCounts[card.rarity] || 0) + count;
      if (card.type === 'Land') landCount += count; else nonLandCount += count;
    });

    const total     = landCount + nonLandCount + badIds.reduce((s, id) => {
      const e = cards.find(x => x.id === id); return s + (e ? e.count : 0);
    }, 0);

    // For total, use raw count sum:
    const rawTotal = cards.reduce((s, e) => s + e.count, 0);

    check('C4.' + formatName + '.' + slug + ' total = 70',
          rawTotal === 70, 'got ' + rawTotal);
    check('C5.' + formatName + '.' + slug + ' lands = 24',
          landCount === 24, 'got ' + landCount);
    check('C6.' + formatName + '.' + slug + ' non-land = 46',
          nonLandCount === 46, 'got ' + nonLandCount);
    check('C7.' + formatName + '.' + slug + ' all card ids resolve',
          badIds.length === 0, 'bad ids: ' + badIds.join(', '));
    check('C8.' + formatName + '.' + slug + ' slug in slug_mappings',
          validSlugs.has(slug), 'slug "' + slug + '" not in DECK_SLUGS');

    // Classic: max 4 copies per card
    if (formatName === 'Classic') {
      const over4 = Object.entries(copyCounts).filter(([, n]) => n > CLASSIC_MAXCOPY);
      check('C9.' + formatName + '.' + slug + ' no card > 4 copies',
            over4.length === 0,
            over4.map(([id, n]) => id + 'x' + n).join(', '));
    }

    // Standard: deck-total rarity caps
    if (formatName === 'Standard') {
      for (const [rarity, cap] of Object.entries(STANDARD_CAPS)) {
        const total = rarityCounts[rarity] || 0;
        check('C10.' + slug + '.' + rarity + ' total <= ' + cap + ' (Standard cap)',
              total <= cap, 'got ' + total);
      }
    }
  }
}

check('C11 total deck count = 12', totalDecks === 12, 'got ' + totalDecks);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n' + (pass + fail) + ' checks: ' + pass + ' passed, ' + fail + ' failed.');
if (fail > 0) {
  console.log('VALIDATION FAILED');
  process.exit(1);
} else {
  console.log('VALIDATION PASSED');
}
