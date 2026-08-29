const fs = require('fs');
const SLUGS = require('./slug_mappings');
const c = require('./card_database.json');
const cards = Array.isArray(c) ? c : (c.cards || []);
const cardMap = new Map(cards.map(x => [x.id, x]));

const colors = SLUGS.COLORS;
const slugs = SLUGS.DECK_SLUGS;
const strategy = SLUGS.STRATEGY;
const formats = SLUGS.FORMATS;

const NONLAND_TARGET = 46; // 46 non-land + 24 land = 70 card deck
const LAND_COUNT = 24;

function getCost(card) {
  if (typeof card.cost === 'number') return card.cost;
  return (card.cost && ((card.cost.generic || 0) + (card.cost.color ? 1 : 0))) || 0;
}

// Sort a faction's non-land pool by cost, then type priority (Champion-first curve).
function sortPool(col) {
  const tp = (t) => t === 'Champion' ? 0 : t === 'Instant' ? 1 : t === 'Spell' ? 2 :
    t === 'Decree' ? 3 : t === 'Relic' ? 4 : t === 'Omen' ? 5 : t === 'Domain' ? 6 : 7;
  return cards
    .filter(x => x.color === col && x.type !== 'Land')
    .sort((a, b) => {
      const ca = getCost(a), cb = getCost(b);
      if (ca !== cb) return ca - cb;
      return tp(a.type) - tp(b.type);
    });
}

// Build a faction's non-land deck for a given format's copy cap.
 // Both Classic and Standard now use max 4 copies per card (no rarity caps).
 function buildDeck(col, formatName) {
   const pool = sortPool(col);
   const fmt  = SLUGS.FORMATS[formatName];

   const deck = [];
   let nonland = 0;

   pool.forEach(card => {
     if (nonland >= NONLAND_TARGET) return;

     // Both formats: max 4 copies per card
     let copies = Math.min(4, NONLAND_TARGET - nonland);
     if (copies <= 0) return;

     deck.push({ id: card.id, count: copies });
     nonland += copies;
   });
   return deck;
 }

function buildLands(col) {
  let pool = cards.filter(x => x.type === 'Land' && x.color === col);
  if (pool.length === 0) pool = cards.filter(x => x.type === 'Land' && x.color !== 'Colorless');
  const lands = [];
  for (let i = 0; i < LAND_COUNT; i++) {
    const card = pool[i % pool.length];
    const entry = lands.find(x => x.id === card.id);
    if (entry) entry.count++;
    else lands.push({ id: card.id, count: 1 });
  }
  return lands;
}

// Build the full decks.json: { formats: { <Format>: { decks: { <slug>: {...} } } } }
const output = { formats: {} };
for (const [formatName, fmt] of Object.entries(formats)) {
  const decks = {};
  colors.filter(col => slugs[col]).forEach(col => {
    const nonlandCards = buildDeck(col, formatName);
    const landCards = buildLands(col);
    decks[slugs[col]] = {
      name: col + ' ' + formatName,
      faction: col,
      format: formatName,
      strategy: strategy[col],
      lands: LAND_COUNT,
      total: LAND_COUNT + NONLAND_TARGET,
      cards: [...landCards, ...nonlandCards]
    };
  });
  output.formats[formatName] = { decks };
}

fs.writeFileSync('decks.json', JSON.stringify(output, null, 2));

// Report
console.log('=== Generated decks.json (formats: Classic 4x, Standard rarity-capped) ===');
for (const [formatName, fmt] of Object.entries(output.formats)) {
  for (const [slug, deck] of Object.entries(fmt.decks)) {
    const total = deck.cards.reduce((a, e) => a + e.count, 0);
    const nonland = total - deck.lands;
    const flag = total === 70 ? '' : '  <-- NOT 70!';
    console.log(`${formatName}/${slug}: nonland=${nonland} lands=${deck.lands} total=${total} entries=${deck.cards.length}${flag}`);
  }
}
console.log('wrote decks.json');
