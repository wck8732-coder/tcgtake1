// CardDatabaseLoader.cs
// Runtime loader for the 480-card library. Mirrors the game.js / simulate.js
// pattern: load ALL cards into RAM once at startup, index by id for O(1) lookup.
// (MTG Arena pattern: fetch-once, index-once. Token/RAM efficient at 480 cards.)
// Requires UPM package: com.unity.nuget.newtonsoft-json
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Newtonsoft.Json;
using UnityEngine;

namespace TCG
{
    public static class CardDatabaseLoader
    {
        private static CardDatabase _database;
        private static Dictionary<int, CardData> _cardMap;

        public static CardDatabase LoadDatabase()
        {
            if (_database != null) return _database;

            string jsonPath = Path.Combine(Application.streamingAssetsPath, "cards.json");
            if (!File.Exists(jsonPath))
            {
                Debug.LogError($"TCG: Card database not found at {jsonPath}. Run `node build-unity-cards.js` first.");
                return null;
            }

            string json = File.ReadAllText(jsonPath);
            _database = JsonConvert.DeserializeObject<CardDatabase>(json);

            _cardMap = new Dictionary<int, CardData>(_database.cards.Count);
            foreach (var card in _database.cards)
                _cardMap[card.id] = card;

            Debug.Log($"TCG: Loaded {_database.cards.Count} cards from {jsonPath}");
            return _database;
        }

        public static CardData GetCard(int id)
        {
            if (_database == null) LoadDatabase();
            return _cardMap != null && _cardMap.TryGetValue(id, out var card) ? card : null;
        }

        public static IReadOnlyList<CardData> GetAllCards()
        {
            if (_database == null) LoadDatabase();
            return _database?.cards ?? new List<CardData>();
        }

        public static List<CardData> GetCardsByFaction(string faction)
        {
            return GetAllCards().Where(c => c.color == faction).ToList();
        }

        public static int Count => _database?.cards?.Count ?? 0;
    }
}
