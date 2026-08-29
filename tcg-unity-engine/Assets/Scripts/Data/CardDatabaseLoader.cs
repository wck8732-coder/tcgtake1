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

namespace TCG.Data
{
    public static class CardDatabaseLoader
    {
        private static CardDatabase _database;
        private static Dictionary<int, CardData> _cardMap;
        private static Dictionary<string, CardData> _cardIdMap; // by cardId string

        /// <summary>
        /// Load the card database from StreamingAssets/cards.json
        /// Call once at startup (e.g., from GameManager.Awake)
        /// </summary>
        public static CardDatabase LoadDatabase()
        {
            if (_database != null) return _database;

            string jsonPath = Path.Combine(Application.streamingAssetsPath, "cards.json");
#if UNITY_ANDROID && !UNITY_EDITOR
            // Android: StreamingAssets requires UnityWebRequest
            // This is a simplified version; use UnityWebRequest in production
#endif
            if (!File.Exists(jsonPath))
            {
                Debug.LogError($"TCG: Card database not found at {jsonPath}. Run `node build-unity-cards.js` first.");
                return null;
            }

            string json = File.ReadAllText(jsonPath);
            _database = JsonConvert.DeserializeObject<CardDatabase>(json);

            _cardMap = new Dictionary<int, CardData>(_database.cards.Count);
            _cardIdMap = new Dictionary<string, CardData>(_database.cards.Count);
            foreach (var card in _database.cards)
            {
                _cardMap[card.id] = card;
                if (!string.IsNullOrEmpty(card.cardId))
                    _cardIdMap[card.cardId] = card;
            }

            Debug.Log($"TCG: Loaded {_database.cards.Count} cards from {jsonPath}");
            return _database;
        }

        /// <summary>
        /// Get card by numeric ID (O(1))
        /// </summary>
        public static CardData GetCard(int id)
        {
            if (_database == null) LoadDatabase();
            return _cardMap != null && _cardMap.TryGetValue(id, out var card) ? card : null;
        }

        /// <summary>
        /// Get card by string cardId (O(1))
        /// </summary>
        public static CardData GetCardById(string cardId)
        {
            if (_database == null) LoadDatabase();
            return _cardIdMap != null && _cardIdMap.TryGetValue(cardId, out var card) ? card : null;
        }

        /// <summary>
        /// Get all cards (read-only)
        /// </summary>
        public static IReadOnlyList<CardData> GetAllCards()
        {
            if (_database == null) LoadDatabase();
            return _database?.cards ?? new List<CardData>();
        }

        /// <summary>
        /// Get cards by faction/color
        /// </summary>
        public static List<CardData> GetCardsByFaction(string faction)
        {
            return GetAllCards().Where(c => c.color == faction).ToList();
        }

        /// <summary>
        /// Get cards by type
        /// </summary>
        public static List<CardData> GetCardsByType(CardType type)
        {
            return GetAllCards().Where(c => c.type == type).ToList();
        }

        /// <summary>
        /// Get cards by rarity
        /// </summary>
        public static List<CardData> GetCardsByRarity(Rarity rarity)
        {
            return GetAllCards().Where(c => c.rarity == rarity).ToList();
        }

        /// <summary>
        /// Get cards with a specific keyword
        /// </summary>
        public static List<CardData> GetCardsWithKeyword(KeywordFlags keyword)
        {
            return GetAllCards().Where(c => c.HasKeyword(keyword)).ToList();
        }

        /// <summary>
        /// Total card count
        /// </summary>
        public static int Count => _database?.cards?.Count ?? 0;

        /// <summary>
        /// Clear cached database (for editor testing / hot reload)
        /// </summary>
        public static void ClearCache()
        {
            _database = null;
            _cardMap = null;
            _cardIdMap = null;
        }

        /// <summary>
        /// Load decks database from StreamingAssets/decks.json
        /// </summary>
        public static DecksDatabase LoadDecks()
        {
            string jsonPath = Path.Combine(Application.streamingAssetsPath, "decks.json");
            if (!File.Exists(jsonPath))
            {
                Debug.LogWarning($"TCG: Decks database not found at {jsonPath}");
                return null;
            }

            string json = File.ReadAllText(jsonPath);
            return JsonConvert.DeserializeObject<DecksDatabase>(json);
        }
    }
}