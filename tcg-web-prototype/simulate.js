#!/usr/bin/env node
// Headless TCG simulator - AI vs AI batch games, no browser required.
// Thin harness over the canonical engine: rules_engine.js.
// Usage: node simulate.js [num_games] [difficulty]

const fs = require('fs');
const path = require('path');
const RULES = require('./rules_engine');
const { GameState, shuffle, deepClone } = RULES;

const NUM_GAMES = parseInt(process.argv[2]) || 100;
const DIFFICULTY = process.argv[3] || 'medium';
const FORMAT = process.argv[4] || 'Classic';

// ==================== SIMULATION ====================

function run() {
  const cardDB = JSON.parse(fs.readFileSync(path.join(__dirname, 'card_database.json'), 'utf8'));
  const deckDB = JSON.parse(fs.readFileSync(path.join(__dirname, 'decks.json'), 'utf8'));

  const formatDecks = (deckDB.formats && deckDB.formats[FORMAT] || deckDB).decks;
  const deckKeys = Object.keys(formatDecks);
  const results = [];
  const factionWins = {};
  const factionGames = {};
  deckKeys.forEach(k => { factionWins[k] = 0; factionGames[k] = 0; });

  const startTime = Date.now();

  for (let i = 0; i < NUM_GAMES; i++) {
    const playerDeckKey = deckKeys[i % deckKeys.length];
    const game = new GameState(DIFFICULTY, playerDeckKey, cardDB, deckDB, FORMAT);
    const info = game.startGame();
    const result = game.runGame();

    // Track faction matchup stats
    const matchup = `${info.playerFaction} vs ${info.aiFaction}`;
    factionGames[playerDeckKey] = (factionGames[playerDeckKey] || 0) + 1;

    if (result.winner === 0) {
      factionWins[playerDeckKey] = (factionWins[playerDeckKey] || 0) + 1;
    }

    results.push({
      gameNum: i + 1,
      playerFaction: info.playerFaction,
      aiFaction: info.aiFaction,
      winner: result.winner === 0 ? 'Player' : 'AI',
      turns: result.turns,
      reason: result.reason,
      playerLife: result.playerLife,
      aiLife: result.aiLife
    });
  }

  const elapsed = Date.now() - startTime;
  const playerWins = results.filter(r => r.winner === 'Player').length;
  const aiWins = results.filter(r => r.winner === 'AI').length;
  const stalled = results.filter(r => r.reason === 'stalled').length;
  const avgTurns = results.reduce((s, r) => s + r.turns, 0) / results.length;

  console.log('\n========================================');
  console.log('  TCG HEADLESS SIMULATION RESULTS');
  console.log('========================================');
  console.log(`  Games: ${NUM_GAMES} | Difficulty: ${DIFFICULTY}`);
  console.log(`  Time: ${elapsed}ms (${(elapsed / NUM_GAMES).toFixed(1)}ms/game)`);
  console.log('----------------------------------------');
  console.log(`  Player Wins: ${playerWins} (${(playerWins / NUM_GAMES * 100).toFixed(1)}%)`);
  console.log(`  AI Wins:     ${aiWins} (${(aiWins / NUM_GAMES * 100).toFixed(1)}%)`);
  if (stalled > 0) console.log(`  Stalled:     ${stalled}`);
  console.log(`  Avg Turns:   ${avgTurns.toFixed(1)}`);
  console.log('----------------------------------------');
  console.log('  Win Rate by Deck:');
  for (const key of deckKeys) {
    const deck = formatDecks[key];
    const wins = factionWins[key] || 0;
    const games = factionGames[key] || 1;
    console.log(`    ${deck.name} (${deck.faction}): ${wins}/${games} (${(wins / games * 100).toFixed(0)}%)`);
  }
  console.log('----------------------------------------');

  // Turn distribution
  const turnDist = {};
  results.forEach(r => {
    const bucket = r.turns;
    turnDist[bucket] = (turnDist[bucket] || 0) + 1;
  });
  const sortedTurns = Object.entries(turnDist).sort((a, b) => Number(a[0]) - Number(b[0]));
  console.log('  Turn Distribution:');
  for (const [turns, count] of sortedTurns) {
    const bar = '#'.repeat(Math.ceil(count / NUM_GAMES * 60));
    console.log(`    Turn ${turns.padStart(3)}: ${count.toString().padStart(4)} ${bar}`);
  }

  console.log('========================================\n');
}

run();
