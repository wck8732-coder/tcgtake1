/*!
 * build-unity-cards.js
 * Generator for Unity card data. Reads the LIVE 480-card set (card_database.json)
 * and emits unity/Assets/StreamingAssets/cards.json in CardDatabase wrapper format
 * { metadata, cards:[...] } matching unity/Assets/Scripts/CardData.cs.
 * Run:  node build-unity-cards.js
 * Invoked from the Unity Editor via TCG > Build Unity Card Data (CardImporterEditor).
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'card_database.json');
const OUT_DIR = path.join(ROOT, 'unity', 'Assets', 'StreamingAssets');
const OUT_CARDS = path.join(OUT_DIR, 'cards.json');
const OUT_DECKS = path.join(OUT_DIR, 'decks.json');

function build() {
  if (!fs.existsSync(SRC)) {
    console.error('ERROR: card_database.json not found at', SRC);
    console.error('Run: node build-cards.js build   (regenerates card_database.json)');
    process.exit(1);
  }
  const cards = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  if (!Array.isArray(cards)) {
    console.error('ERROR: card_database.json is not a flat array. Re-run build-cards.js.');
    process.exit(1);
  }

  const factions = Array.from(new Set(cards.filter(c => c.color).map(c => c.color)));
  const rarityCounts = {};
  for (const c of cards) rarityCounts[c.rarity] = (rarityCounts[c.rarity] || 0) + 1;

  const db = {
    metadata: {
      source: 'card_database.json',
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
  const decksSrc = path.join(ROOT, 'decks.json');
  if (fs.existsSync(decksSrc)) {
    fs.copyFileSync(decksSrc, OUT_DECKS);
    console.log('Copied decks.json -> ' + OUT_DECKS + ' (70-card format-split decks: Classic + Standard)');
  } else {
    console.warn('WARNING: decks.json not found; StreamingAssets/decks.json not written.');
  }
}

build();
