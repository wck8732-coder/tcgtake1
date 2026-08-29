/*!
 * build-unity-cards.js
 * Generator for Unity card data. Reads the LIVE 480-card set (card_database.json)
 * and emits Assets/StreamingAssets/cards.json in CardDatabase wrapper format
 * matching Assets/Scripts/Data/CardData.cs.
 * Run:  node build-unity-cards.js
 * Invoked from the Unity Editor via TCG > Build Unity Card Data (CardImporterEditor).
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'data', 'card_database.json');
const DECKS_SRC = path.join(ROOT, 'data', 'decks.json');
const OUT_DIR = path.join(ROOT, 'Assets', 'StreamingAssets');
const OUT_CARDS = path.join(OUT_DIR, 'cards.json');
const OUT_DECKS = path.join(OUT_DIR, 'decks.json');

function build() {
  if (!fs.existsSync(SRC)) {
    console.error('ERROR: card_database.json not found at', SRC);
    console.error('Copy from web prototype: cp ../tcg-web-prototype/card_database.json data/');
    process.exit(1);
  }
  const cards = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  if (!Array.isArray(cards)) {
    console.error('ERROR: card_database.json is not a flat array.');
    process.exit(1);
  }

  const factions = Array.from(new Set(cards.filter(c => c.color).map(c => c.color)));
  const rarityCounts = {};
  for (const c of cards) rarityCounts[c.rarity] = (rarityCounts[c.rarity] || 0) + 1;

  const db = {
    metadata: {
      source: 'data/card_database.json',
      card_count: cards.length,
      factions,
      rarity_counts: rarityCounts,
      schema_version: '1.0',
      build_target: 'unity',
      generated_at: new Date().toISOString()
    },
    cards
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_CARDS, JSON.stringify(db, null, 1));
  console.log(`Wrote ${OUT_CARDS}: ${cards.length} cards, factions=${factions.join(',')}`);

  // Ship decks.json too (v0.1045: 70-card format-split decks, { formats: {Classic, Standard} }).
  if (fs.existsSync(DECKS_SRC)) {
    fs.copyFileSync(DECKS_SRC, OUT_DECKS);
    console.log('Copied decks.json -> ' + OUT_DECKS + ' (70-card format-split decks: Classic + Standard)');
  } else {
    console.warn('WARNING: decks.json not found at ' + DECKS_SRC + '; StreamingAssets/decks.json not written.');
  }
}

build();