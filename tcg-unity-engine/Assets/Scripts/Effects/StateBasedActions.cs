// StateBasedActions.cs
// State-based actions - checked after each stack resolution (MTG rule 704)
// 0 toughness, 0 loyalty, legendary rule, etc.
using System.Collections.Generic;
using System.Linq;
using TCG.Data;

namespace TCG.Effects
{
    /// <summary>
    /// State-based actions run automatically whenever a player would get priority
    /// MTG Comprehensive Rules 704
    /// </summary>
    public class StateBasedActions
    {
        private readonly GameState _gameState;

        public StateBasedActions(GameState gameState)
        {
            _gameState = gameState;
        }

        /// <summary>
        /// Check all state-based actions and perform them
        /// Returns true if any action was performed (should re-check)
        /// </summary>
        public bool CheckAll()
        {
            bool anyAction = false;

            // 704.5f - Creatures with 0 or less toughness go to graveyard
            anyAction |= CheckZeroToughness();

            // 704.5i - Planeswalkers with 0 loyalty go to graveyard
            anyAction |= CheckZeroLoyalty();

            // 704.5j - Legendary rule (same name, different cards)
            anyAction |= CheckLegendaryRule();

            // 704.5k - World rule (world supertype)
            anyAction |= CheckWorldRule();

            // 704.5m - Auras attached to illegal objects
            anyAction |= CheckIllegalAuras();

            // 704.5n - Equipment attached to illegal objects
            anyAction |= CheckIllegalEquipment();

            // 704.5p - Counters on non-permanents
            anyAction |= CheckOrphanedCounters();

            // 704.5q - Saga with no lore counters
            // 704.5r - Class with no level
            // etc.

            // Custom: Ominous flip check
            anyAction |= CheckOminousFlip();

            // Custom: Token in non-battlefield zones
            anyAction |= CheckTokensInWrongZone();

            return anyAction;
        }

        /// <summary>
        /// Run until no more state-based actions
        /// </summary>
        public void RunToCompletion()
        {
            while (CheckAll())
            {
                // Loop until stable
            }
        }

        #region Individual Checks

        private bool CheckZeroToughness()
        {
            bool any = false;
            for (int player = 0; player < 2; player++)
            {
                var battlefield = _gameState.ZoneManager.GetBattlefield(player);
                var toDestroy = battlefield.Where(c => 
                    (c.type == CardType.Champion || c.type == CardType.Token) && 
                    c.health <= 0).ToList();

                foreach (var card in toDestroy)
                {
                    // Check indestructible (Deathshroud)
                    if (card.HasKeyword(KeywordFlags.Deathshroud))
                        continue;

                    _gameState.ZoneManager.Destroy(player, card);
                    any = true;
                }
            }
            return any;
        }

        private bool CheckZeroLoyalty()
        {
            bool any = false;
            for (int player = 0; player < 2; player++)
            {
                var battlefield = _gameState.ZoneManager.GetBattlefield(player);
                var toDestroy = battlefield.Where(c => 
                    c.type == CardType.Token && c.loyalty <= 0).ToList(); // Planeswalkers would be Token type

                foreach (var card in toDestroy)
                {
                    _gameState.ZoneManager.Destroy(player, card);
                    any = true;
                }
            }
            return any;
        }

        private bool CheckLegendaryRule()
        {
            // Our game doesn't have legendary supertype yet
            // But we can implement for future: if two+ permanents with same name and legendary
            return false;
        }

        private bool CheckWorldRule()
        {
            // World supertype not implemented
            return false;
        }

        private bool CheckIllegalAuras()
        {
            // Auras not implemented yet
            return false;
        }

        private bool CheckIllegalEquipment()
        {
            // Equipment not implemented yet
            return false;
        }

        private bool CheckOrphanedCounters()
        {
            // Counters on non-permanents
            return false;
        }

        private bool CheckOminousFlip()
        {
            bool any = false;
            for (int player = 0; player < 2; player++)
            {
                var battlefield = _gameState.ZoneManager.GetBattlefield(player);
                foreach (var card in battlefield)
                {
                    if (card.HasKeyword(KeywordFlags.Ominous) && card.isFlipped)
                    {
                        // Already flipped - check if should unflip (end of turn cleanup)
                        // Ominous flips at end of turn if dealt combat damage
                        // Handled in TurnManager CleanupStep
                    }
                }
            }
            return any;
        }

        private bool CheckTokensInWrongZone()
        {
            bool any = false;
            // Tokens in hand, library, graveyard, exile cease to exist (704.5d)
            for (int player = 0; player < 2; player++)
            {
                var zonesToCheck = new[] { ZoneType.Hand, ZoneType.Library, ZoneType.Graveyard, ZoneType.Exile };
                foreach (var zoneType in zonesToCheck)
                {
                    var zone = _gameState.ZoneManager.GetZone(player, zoneType);
                    var tokens = zone.cards.Where(c => c.isToken).ToList();
                    foreach (var token in tokens)
                    {
                        zone.Remove(token);
                        any = true;
                    }
                }
            }
            return any;
        }

        #endregion
    }
}