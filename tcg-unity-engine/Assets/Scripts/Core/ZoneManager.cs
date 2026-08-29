// ZoneManager.cs
// Zone management for all card zones (Library, Hand, Battlefield, Graveyard, Exile, Command, Stack)
// Mirrors zone logic from simulate.js / game.js
using System.Collections.Generic;
using System.Linq;
using TCG.Data;

namespace TCG.Core
{
    /// <summary>
    /// Represents a zone containing cards for a specific player
    /// </summary>
    [Serializable]
    public class Zone
    {
        public ZoneType type;
        public int ownerPlayerId;
        public List<CardData> cards = new();

        public Zone(ZoneType type, int ownerPlayerId)
        {
            this.type = type;
            this.ownerPlayerId = ownerPlayerId;
        }

        public int Count => cards.Count;
        public bool IsEmpty => cards.Count == 0;

        public void Add(CardData card)
        {
            cards.Add(card);
        }

        public bool Remove(CardData card)
        {
            return cards.Remove(card);
        }

        public CardData RemoveAt(int index)
        {
            if (index < 0 || index >= cards.Count) return null;
            var card = cards[index];
            cards.RemoveAt(index);
            return card;
        }

        public CardData TopCard => cards.Count > 0 ? cards[cards.Count - 1] : null;
        public CardData BottomCard => cards.Count > 0 ? cards[0] : null;

        public void Shuffle()
        {
            var rng = new System.Random();
            int n = cards.Count;
            while (n > 1)
            {
                n--;
                int k = rng.Next(n + 1);
                var temp = cards[k];
                cards[k] = cards[n];
                cards[n] = temp;
            }
        }

        public void Clear() => cards.Clear();
    }

    public enum ZoneType
    {
        Library = 0,
        Hand = 1,
        Battlefield = 2,
        Graveyard = 3,
        Exile = 4,
        Command = 5,
        Stack = 6,
        Sideboard = 7
    }

    /// <summary>
    /// Manages all zones for all players
    /// </summary>
    public class ZoneManager
    {
        private readonly Dictionary<int, Dictionary<ZoneType, Zone>> _playerZones = new();
        private readonly int _playerCount;

        public ZoneManager(int playerCount = 2)
        {
            _playerCount = playerCount;
            for (int i = 0; i < playerCount; i++)
            {
                _playerZones[i] = new Dictionary<ZoneType, Zone>();
                foreach (ZoneType type in System.Enum.GetValues(typeof(ZoneType)))
                {
                    // Stack and Command are shared, not per-player
                    if (type == ZoneType.Stack || type == ZoneType.Command)
                        continue;
                    _playerZones[i][type] = new Zone(type, i);
                }
            }
            // Shared zones
            _playerZones[-1] = new Dictionary<ZoneType, Zone>
            {
                [ZoneType.Stack] = new Zone(ZoneType.Stack, -1),
                [ZoneType.Command] = new Zone(ZoneType.Command, -1)
            };
        }

        public Zone GetZone(int playerId, ZoneType type)
        {
            if (type == ZoneType.Stack || type == ZoneType.Command)
                return _playerZones[-1][type];
            return _playerZones[playerId][type];
        }

        /// <summary>
        /// Move a card from one zone to another
        /// </summary>
        public bool MoveCard(CardData card, ZoneType fromType, ZoneType toType, int playerId, int? toIndex = null)
        {
            var fromZone = GetZone(playerId, fromType);
            var toZone = GetZone(playerId, toType);

            if (!fromZone.Remove(card))
                return false;

            if (toIndex.HasValue && toIndex.Value >= 0 && toIndex.Value <= toZone.Count)
            {
                toZone.cards.Insert(toIndex.Value, card);
            }
            else
            {
                toZone.Add(card);
            }

            // Handle zone-specific logic
            OnZoneChange(card, fromType, toType, playerId);
            return true;
        }

        /// <summary>
        /// Move card by ID (for network/serialization)
        /// </summary>
        public bool MoveCardById(int cardId, ZoneType fromType, ZoneType toType, int playerId, int? toIndex = null)
        {
            var fromZone = GetZone(playerId, fromType);
            var card = fromZone.cards.Find(c => c.id == cardId);
            if (card == null) return false;
            return MoveCard(card, fromType, toType, playerId, toIndex);
        }

        /// <summary>
        /// Draw card from library to hand
        /// </summary>
        public CardData DrawCard(int playerId, int count = 1)
        {
            var library = GetZone(playerId, ZoneType.Library);
            var hand = GetZone(playerId, ZoneType.Hand);
            CardData drawn = null;

            for (int i = 0; i < count; i++)
            {
                if (library.Count == 0) break; // Lose game handled elsewhere
                drawn = library.RemoveAt(library.Count - 1); // Draw from top
                hand.Add(drawn);
            }
            return drawn;
        }

        /// <summary>
        /// Mill cards from library to graveyard
        /// </summary>
        public List<CardData> MillCards(int playerId, int count)
        {
            var library = GetZone(playerId, ZoneType.Library);
            var graveyard = GetZone(playerId, ZoneType.Graveyard);
            var milled = new List<CardData>();

            for (int i = 0; i < count; i++)
            {
                if (library.Count == 0) break;
                var card = library.RemoveAt(library.Count - 1);
                graveyard.Add(card);
                milled.Add(card);
            }
            return milled;
        }

        /// <summary>
        /// Discard from hand to graveyard
        /// </summary>
        public bool Discard(int playerId, CardData card)
        {
            return MoveCard(card, ZoneType.Hand, ZoneType.Graveyard, playerId);
        }

        /// <summary>
        /// Destroy permanent (battlefield to graveyard)
        /// </summary>
        public bool Destroy(int playerId, CardData card)
        {
            return MoveCard(card, ZoneType.Battlefield, ZoneType.Graveyard, playerId);
        }

        /// <summary>
        /// Exile a card
        /// </summary>
        public bool Exile(int playerId, CardData card, ZoneType fromType)
        {
            return MoveCard(card, fromType, ZoneType.Exile, playerId);
        }

        /// <summary>
        /// Return from exile to hand/battlefield
        /// </summary>
        public bool ReturnFromExile(int playerId, CardData card, ZoneType toType)
        {
            return MoveCard(card, ZoneType.Exile, toType, playerId);
        }

        /// <summary>
        /// Put card on top/bottom of library
        /// </summary>
        public bool PutOnLibrary(int playerId, CardData card, bool onTop = true)
        {
            var library = GetZone(playerId, ZoneType.Library);
            var fromZone = FindZoneContainingCard(card);
            if (fromZone == null) return false;

            fromZone.Remove(card);
            if (onTop)
                library.Add(card); // Add to end (top)
            else
                library.cards.Insert(0, card); // Insert at beginning (bottom)
            return true;
        }

        /// <summary>
        /// Shuffle library
        /// </summary>
        public void ShuffleLibrary(int playerId)
        {
            GetZone(playerId, ZoneType.Library).Shuffle();
        }

        /// <summary>
        /// Get all cards on battlefield for a player
        /// </summary>
        public List<CardData> GetBattlefield(int playerId)
        {
            return GetZone(playerId, ZoneType.Battlefield).cards;
        }

        /// <summary>
        /// Get all champions on battlefield
        /// </summary>
        public List<CardData> GetChampions(int playerId)
        {
            return GetBattlefield(playerId).Where(c => c.type == CardType.Champion).ToList();
        }

        /// <summary>
        /// Get all lands on battlefield
        /// </summary>
        public List<CardData> GetLands(int playerId)
        {
            return GetBattlefield(playerId).Where(c => c.type == CardType.Land).ToList();
        }

        /// <summary>
        /// Get hand size
        /// </summary>
        public int GetHandSize(int playerId)
        {
            return GetZone(playerId, ZoneType.Hand).Count;
        }

        /// <summary>
        /// Get library size
        /// </summary>
        public int GetLibrarySize(int playerId)
        {
            return GetZone(playerId, ZoneType.Library).Count;
        }

        /// <summary>
        /// Get graveyard
        /// </summary>
        public List<CardData> GetGraveyard(int playerId)
        {
            return GetZone(playerId, ZoneType.Graveyard).cards;
        }

        /// <summary>
        /// Get exile zone
        /// </summary>
        public List<CardData> GetExile(int playerId)
        {
            return GetZone(playerId, ZoneType.Exile).cards;
        }

        /// <summary>
        /// Get stack (shared)
        /// </summary>
        public Zone GetStack()
        {
            return GetZone(-1, ZoneType.Stack);
        }

        /// <summary>
        /// Find which zone contains a card
        /// </summary>
        private Zone FindZoneContainingCard(CardData card)
        {
            foreach (var playerZones in _playerZones.Values)
            {
                foreach (var zone in playerZones.Values)
                {
                    if (zone.cards.Contains(card))
                        return zone;
                }
            }
            return null;
        }

        /// <summary>
        /// Hook for zone change triggers (ETB, LTB, etc.)
        /// </summary>
        private void OnZoneChange(CardData card, ZoneType from, ZoneType to, int playerId)
        {
            // Trigger ETB/LTB abilities via GameState
            // GameState.Instance?.TriggerZoneChange(card, from, to, playerId);
        }

        /// <summary>
        /// Reset all zones for new game
        /// </summary>
        public void Reset()
        {
            foreach (var playerZones in _playerZones.Values)
            {
                foreach (var zone in playerZones.Values)
                {
                    zone.Clear();
                }
            }
        }
    }
}