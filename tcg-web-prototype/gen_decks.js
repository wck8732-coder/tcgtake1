// gen_decks.js
// This script generates TCG decks based on the DECKBUILDER_PLAN.md algorithm.
// It incorporates lessons from MTG premade success, Frank Karsten's land math,
// and MTG Arena NPE to create balanced, teachable decks for new players.
// The script reads from card_database.json and slug_mappings.js, and outputs
// decks in the required format. It also includes a --dry flag for testing.

const fs = require('fs');
const path = require('path');

// Load card database and slug mappings
const cardDatabase = JSON.parse(fs.readFileSync(path.join(__dirname, 'card_database.json'), 'utf8'));
const slugMappings = require('./slug_mappings.js');

// Constants
const LANDS_PER_DECK = 24;
const NON_LANDS_PER_DECK = 46;
const TOTAL_CARDS_PER_DECK = 70;
const MAX_COPIES_PER_CARD = 4;
const FORMATS = slugMappings.FORMATS;
const DECK_SLUGS = slugMappings.DECK_SLUGS;
const STRATEGY = slugMappings.STRATEGY;
const COLORS = slugMappings.COLORS;

// Archetype profiles + Karsten-derived curve slots s_n (sum 46, 89+n% on-play, 70-card)
// Aggro leans 1-2, control leans 3-5, per DECKBUILDER_PLAN.md Step0
const ARCHETYPE_PROFILES = {
  Crimson: { avgMV: 2.3, curveSlots: [12,11,9,6,4,4] }, // aggro-burn
  Zealot: { avgMV: 2.5, curveSlots: [11,10,9,7,5,4] },   // aggro-buff
  Lantern: { avgMV: 2.9, curveSlots: [9,9,9,8,6,5] },    // midrange-death
  Colorless: { avgMV: 3.0, curveSlots: [8,9,9,8,6,6] },  // artifact-midrange
  Sunforged: { avgMV: 3.2, curveSlots: [7,8,9,9,7,6] },  // ramp-stompy
  Gilded: { avgMV: 3.3, curveSlots: [6,8,9,9,7,7] }      // control-draw
};

// Function to get the cost of a card
function getCost(card) {
  if (typeof card.cost === 'number') {
    return card.cost;
  } else {
    return (card.cost.generic || 0) + (card.cost.color ? 1 : 0);
  }
}

// Function to build lands
function buildLands(faction) {
  let pool = cardDatabase.filter(card => card.type === 'Land' && card.color === faction);
  if (pool.length === 0) {
    pool = cardDatabase.filter(card => card.type === 'Land' && card.color !== 'Colorless');
  }
  const lands = [];
  for (let i = 0; i < LANDS_PER_DECK; i++) {
    lands.push(pool[i % pool.length]);
  }
  const landCounts = lands.reduce((acc, land) => {
    acc[land.id] = (acc[land.id] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(landCounts).map(([id, count]) => ({ id: parseInt(id,10), count }));
}

// Function to generate a deck
function generateDeck(faction, format) {
  const archetype = ARCHETYPE_PROFILES[faction];
  const avgMV = archetype.avgMV;
  const landsExpected = (19.59 + 1.90 * avgMV) * TOTAL_CARDS_PER_DECK / 60;
  const curveSlots = archetype.curveSlots; // per-faction Karsten s1..s6

  const deck = {
    name: `${faction} ${format} Deck`,
    faction,
    format,
    strategy: STRATEGY[faction],
    lands: LANDS_PER_DECK,
    total: TOTAL_CARDS_PER_DECK,
    cards: []
  };

  const lands = buildLands(faction);
  deck.cards = lands;

  const nonLands = cardDatabase.filter(card => card.color === faction && card.type !== 'Land');
  const typePriority = {
    Champion: 0,
    Instant: 1,
    Spell: 2,
    Decree: 3,
    Relic: 4,
    Omen: 5,
    Domain: 6
  };

  nonLands.sort((a, b) => {
    const costDiff = getCost(a) - getCost(b);
    if (costDiff !== 0) return costDiff;
    return typePriority[a.type] - typePriority[b.type];
  });

  // Fill per-CMC buckets s_n, respecting 4-copy cap and preferring champions
  let totalNonland = 0;
  // bucket by CMC (6 = 6+)
  const byCmc = {1:[],2:[],3:[],4:[],5:[],6:[]};
  for (const card of nonLands) {
    let cmc = getCost(card);
    if (cmc >= 6) cmc = 6;
    if (cmc < 1) cmc = 1;
    byCmc[cmc].push(card);
  }
  for (let cmc = 1; cmc <= 6; cmc++) {
    let need = curveSlots[cmc-1];
    for (const card of byCmc[cmc]) {
      if (need <= 0 || totalNonland >= NON_LANDS_PER_DECK) break;
      const take = Math.min(MAX_COPIES_PER_CARD, need, NON_LANDS_PER_DECK - totalNonland);
      deck.cards.push({ id: card.id, count: take });
      totalNonland += take;
      need -= take;
    }
  }
  // If still short (e.g. faction lacks cards at some CMC), fill cheapest remaining
  if (totalNonland < NON_LANDS_PER_DECK) {
    for (const card of nonLands) {
      if (totalNonland >= NON_LANDS_PER_DECK) break;
      if (deck.cards.some(c => c.id === card.id)) continue;
      const take = Math.min(MAX_COPIES_PER_CARD, NON_LANDS_PER_DECK - totalNonland);
      deck.cards.push({ id: card.id, count: take });
      totalNonland += take;
    }
  }

  return deck;
}

// Function to generate decks for a format
function generateDecksForFormat(formatName) {
  const decks = {};
  for (let faction in ARCHETYPE_PROFILES) {
    const deck = generateDeck(faction, formatName);
    const slug = DECK_SLUGS[faction];
    decks[slug] = deck;
  }
  return decks;
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry');
  const faction = args.find(arg => !arg.startsWith('--'));

  if (dryRun) {
    if (faction) {
      const archetype = ARCHETYPE_PROFILES[faction];
      const curveSlots = ARCHETYPE_PROFILES[faction].curveSlots;
      const deck = {
        name: `${faction} Dry Run Deck`,
        faction,
        format: 'Dry Run',
        strategy: STRATEGY[faction],
        lands: LANDS_PER_DECK,
        total: TOTAL_CARDS_PER_DECK,
        cards: []
      };
      console.log(`Template for ${faction}:`);
      console.log(`avgMV: ${archetype.avgMV}`);
      console.log(`Curve Slots: ${curveSlots.join(', ')}`);
      console.log(`Score: ${calculateScore(deck)}`);
    } else {
      console.log('Please specify a faction for dry run.');
    }
  } else {
    const decks = {
      Classic: { decks: generateDecksForFormat('Classic') },
      Standard: { decks: generateDecksForFormat('Standard') }
    };

    const output = JSON.stringify({ formats: decks }, null, 2);
    fs.writeFileSync('decks.json', output);

    for (let format in decks) {
      for (let slug in decks[format].decks) {
        const deck = decks[format].decks[slug];
        const total = deck.cards.reduce((a,c)=>a+c.count,0);
        const landCopies = deck.cards.filter(c=>{
          const card = cardDatabase.find(x=>x.id===c.id);
          return card && card.type==='Land';
        }).reduce((a,c)=>a+c.count,0);
        console.log(`${format}/${slug}: total=${total} lands=${landCopies} nonland=${total-landCopies} entries=${deck.cards.length}`);
      }
    }
  }
}

// Calculate consistency score (stub)
function calculateScore(deck) {
  // Implement consistency scoring logic here
  return 0.85; // Placeholder score
}

// Run the main function
main();
