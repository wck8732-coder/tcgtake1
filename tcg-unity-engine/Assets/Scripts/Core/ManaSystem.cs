// ManaSystem.cs
// Mana pool, land tapping, cost payment - port of shared/cost-utils.js
// Handles v0.1042 cost format: int(0) for lands, or {color,generic} object for spells
using System.Collections.Generic;
using TCG.Data;

namespace TCG.Core
{
    /// <summary>
    /// Represents a player's mana pool (colored + colorless)
    /// </summary>
    [Serializable]
    public class ManaPool
    {
        public int white;
        public int blue;
        public int black;
        public int red;
        public int green;
        public int colorless;

        public int Total => white + blue + black + red + green + colorless;

        public void Add(ManaCost cost)
        {
            if (cost.isLand) return;
            if (!string.IsNullOrEmpty(cost.color))
            {
                switch (cost.color.ToUpper())
                {
                    case "W": white += 1; break;
                    case "U": blue += 1; break;
                    case "B": black += 1; break;
                    case "R": red += 1; break;
                    case "G": green += 1; break;
                    case "C": colorless += 1; break;
                }
            }
            colorless += cost.generic;
        }

        public void Remove(ManaCost cost)
        {
            if (cost.isLand) return;
            PayCost(cost);
        }

        /// <summary>
        /// Attempt to pay a mana cost. Returns true if successful.
        /// Implements MTG mana payment rules (pay colored first, then generic from any)
        /// </summary>
        public bool PayCost(ManaCost cost)
        {
            if (cost.isLand) return true;

            // Check if we have enough total mana
            if (Total < cost.TotalValue) return false;

            // Try to pay colored requirement first
            if (!string.IsNullOrEmpty(cost.color))
            {
                var available = GetColorMana(cost.color);
                if (available < 1) return false;
                SpendColorMana(cost.color, 1);
            }

            // Pay generic from any source (prioritize colorless, then colored)
            int remaining = cost.generic;
            if (remaining > 0)
            {
                // Use colorless first
                int fromColorless = Math.Min(colorless, remaining);
                colorless -= fromColorless;
                remaining -= fromColorless;

                // Then use colored mana (any color)
                if (remaining > 0)
                {
                    int[] colored = { white, blue, black, red, green };
                    for (int i = 0; i < colored.Length && remaining > 0; i++)
                    {
                        int spend = Math.Min(colored[i], remaining);
                        colored[i] -= spend;
                        remaining -= spend;
                    }
                    // Update back
                    white = colored[0]; blue = colored[1]; black = colored[2]; red = colored[3]; green = colored[4];
                }
            }

            return remaining == 0;
        }

        /// <summary>
        /// Check if cost can be paid without actually paying
        /// </summary>
        public bool CanPay(ManaCost cost)
        {
            if (cost.isLand) return true;
            if (Total < cost.TotalValue) return false;

            // Check colored requirement
            if (!string.IsNullOrEmpty(cost.color))
            {
                if (GetColorMana(cost.color) < 1) return false;
            }

            return true;
        }

        public int GetColorMana(string color)
        {
            return color.ToUpper() switch
            {
                "W" => white,
                "U" => blue,
                "B" => black,
                "R" => red,
                "G" => green,
                "C" => colorless,
                _ => 0
            };
        }

        public void SpendColorMana(string color, int amount)
        {
            switch (color.ToUpper())
            {
                case "W": white = Math.Max(0, white - amount); break;
                case "U": blue = Math.Max(0, blue - amount); break;
                case "B": black = Math.Max(0, black - amount); break;
                case "R": red = Math.Max(0, red - amount); break;
                case "G": green = Math.Max(0, green - amount); break;
                case "C": colorless = Math.Max(0, colorless - amount); break;
            }
        }

        public void Clear() => white = blue = black = red = green = colorless = 0;

        public override string ToString() => $"W:{white} U:{blue} B:{black} R:{red} G:{green} C:{colorless}";
    }

    /// <summary>
    /// Manages mana for all players - land tapping, mana abilities, emptying pool
    /// </summary>
    public class ManaSystem
    {
        private readonly ManaPool[] _playerPools;
        private readonly Dictionary<int, List<CardData>> _tappedLands = new(); // player -> tapped lands

        public ManaSystem(int playerCount = 2)
        {
            _playerPools = new ManaPool[playerCount];
            for (int i = 0; i < playerCount; i++)
                _playerPools[i] = new ManaPool();
        }

        public ManaPool GetPool(int playerId) => _playerPools[playerId];

        /// <summary>
        /// Tap a land for mana (adds to pool)
        /// </summary>
        public void TapLand(int playerId, CardData land)
        {
            if (land.type != CardType.Land) return;

            var pool = _playerPools[playerId];
            if (land.cost != null && !land.cost.isLand)
            {
                // Land produces specific mana (e.g., basic lands, dual lands)
                pool.Add(land.cost);
            }
            else
            {
                // Default: basic land produces 1 of its color
                if (!string.IsNullOrEmpty(land.color))
                {
                    var cost = new ManaCost { color = land.color, generic = 0, isLand = false };
                    pool.Add(cost);
                }
            }

            if (!_tappedLands.ContainsKey(playerId))
                _tappedLands[playerId] = new List<CardData>();
            _tappedLands[playerId].Add(land);
        }

        /// <summary>
        /// Untap all lands for a player (start of turn)
        /// </summary>
        public void UntapAllLands(int playerId)
        {
            if (_tappedLands.ContainsKey(playerId))
                _tappedLands[playerId].Clear();
        }

        /// <summary>
        /// Empty mana pool (end of step/phase)
        /// </summary>
        public void EmptyPool(int playerId)
        {
            _playerPools[playerId].Clear();
        }

        /// <summary>
        /// Empty all mana pools
        /// </summary>
        public void EmptyAllPools()
        {
            foreach (var pool in _playerPools)
                pool.Clear();
        }

        /// <summary>
        /// Try to pay a cost from player's mana pool
        /// </summary>
        public bool PayMana(int playerId, ManaCost cost)
        {
            return _playerPools[playerId].PayCost(cost);
        }

        /// <summary>
        /// Check if player can pay cost
        /// </summary>
        public bool CanPayMana(int playerId, ManaCost cost)
        {
            return _playerPools[playerId].CanPay(cost);
        }

        /// <summary>
        /// Auto-tap lands to pay for a cost (MTGA-style auto-tap)
        /// Returns list of lands that would be tapped
        /// </summary>
        public List<CardData> GetAutoTapPlan(int playerId, ManaCost cost)
        {
            var plan = new List<CardData>();
            var pool = _playerPools[playerId].Total; // available mana

            // This is a simplified version - real MTGA uses complex optimization
            // For now, just return untapped lands of matching color
            if (_tappedLands.TryGetValue(playerId, out var tapped))
            {
                // In a real implementation, we'd check all lands on battlefield
                // and find the optimal tap combination
            }

            return plan;
        }
    }

    /// <summary>
    /// Static utility matching shared/cost-utils.js exactly
    /// </summary>
    public static class CostSystem
    {
        /// <summary>
        /// Normalize cost to ManaCost object (ports normalizeCost)
        /// </summary>
        public static ManaCost Normalize(object cost)
        {
            return ManaCost.FromJToken(JToken.FromObject(cost));
        }

        /// <summary>
        /// Get total mana value (ports totalCostValue)
        /// </summary>
        public static int TotalValue(object cost)
        {
            var mc = Normalize(cost);
            return mc.TotalValue;
        }

        /// <summary>
        /// Check if player can pay cost (ports canPayCost)
        /// </summary>
        public static bool CanPay(ManaPool pool, object cost)
        {
            var mc = Normalize(cost);
            return pool.CanPay(mc);
        }

        /// <summary>
        /// Pay mana from pool (ports payMana)
        /// </summary>
        public static bool PayMana(ManaPool pool, object cost)
        {
            var mc = Normalize(cost);
            return pool.PayCost(mc);
        }
    }
}