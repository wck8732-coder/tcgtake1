// GameState.cs  (PREPARATION STUB)
// Port target: simulate.js (class GameState, v0.1045).
// NOTE: Full rules port is gated on the decks.json rebuild (70-card pools).
//       Deck building here mirrors buildDeckFromDef: max 4 copies/card, min 70.
//       decks.json now uses { formats: { Classic, Standard } -> { decks } } shape.
using System.Collections.Generic;
using UnityEngine;
using TCG;

namespace TCG.Engine
{
    public class GameState : MonoBehaviour
    {
        private CardDatabase _db;
        private Dictionary<int, CardData> _cardMap; // built once (mirrors __CARD_MAP__)

        // Port: GameState constructor(difficulty, deckKey, format, cardDB, deckDB)
        // format is 'Classic' or 'Standard'. Classic = max 4x copies;
        // Standard applies rarity caps via CardDatabaseLoader / deck asset.
        public void Initialize(string format = "Classic")
        {
            _db = CardDatabaseLoader.LoadDatabase();
            _cardMap = new Dictionary<int, CardData>(_db.cards.Count);
            foreach (var c in _db.cards) _cardMap[c.id] = c;
            // TODO: wire deck selection (deckDB.formats[format].decks) once C# deck loader lands.
        }

        // Port: buildDeckFromDef — enforces 4-copy + 70-min (Classic) / rarity caps (Standard).
        public List<CardData> BuildDeckFromDef(dynamic deckDef)
        {
            var counts = new Dictionary<int, int>();
            var deck = new List<CardData>();
            // TODO: iterate deckDef.cards; cap at 4 (Classic) or per-rarity (Standard); enforce 70-min.
            return deck;
        }

        // TODO: port phase flow (Draw -> Main -> Combat -> End) once decks are rebuilt.
    }
}
