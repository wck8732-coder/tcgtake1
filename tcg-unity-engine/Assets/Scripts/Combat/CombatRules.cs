// CombatRules.cs
// Static combat legality rules - Flying, Intimidate, Guard, etc.
// Centralizes all "can this block that" logic
using TCG.Data;
using TCG.Effects.KeywordBehaviours;

namespace TCG.Combat
{
    /// <summary>
    /// Static combat rules - all block/attack legality checks
    /// </summary>
    public static class CombatRules
    {
        /// <summary>
        /// Can blocker legally block attacker?
        /// Checks: Flying, Intimidate, Guard, Bastion (targeting), etc.
        /// </summary>
        public static bool CanBlock(CardData attacker, CardData blocker, GameState gameState)
        {
            // Basic checks
            if (blocker.type != CardType.Champion) return false;
            if (blocker.isTapped) return false;
            if (attacker == blocker) return false; // Can't block yourself

            // Flying: only flyers/Keen Eye can block
            if (FlyingBehaviour.HasFlying(attacker))
            {
                if (!FlyingBehaviour.HasFlying(blocker) && !KeenEyeBehaviour.HasKeenEye(blocker))
                    return false;
            }

            // Intimidate: only same color or colorless can block
            if (IntimidateBehaviour.HasIntimidate(attacker))
            {
                if (!IntimidateBehaviour.CanBeBlockedBy(attacker, blocker))
                    return false;
            }

            // Bastion: can't be targeted by opponent's abilities
            // (Blocking is a game action, not a target, so this doesn't apply directly)
            // But some "target creature blocks" effects would be affected

            // Guard: must block if able (handled at declare blockers step, not here)

            // Additional custom rules can be added here

            return true;
        }

        /// <summary>
        /// Get all legal blockers for an attacker
        /// </summary>
        public static List<CardData> GetLegalBlockers(CardData attacker, int defenderPlayerId, GameState gameState)
        {
            var battlefield = gameState.ZoneManager.GetBattlefield(defenderPlayerId);
            return battlefield.Where(c => CanBlock(attacker, c, gameState)).ToList();
        }

        /// <summary>
        /// Must this creature be blocked if able? (Guard, lure effects)
        /// </summary>
        public static bool MustBeBlocked(CardData attacker)
        {
            if (GuardBehaviour.HasGuard(attacker)) return true;
            // Check for "must be blocked" effects (lure, etc.)
            return false;
        }

        /// <summary>
        /// Can this creature attack? (Basic checks, not including "must attack")
        /// </summary>
        public static bool CanAttack(CardData attacker, GameState gameState)
        {
            if (attacker.type != CardType.Champion) return false;
            if (attacker.isTapped) return false;

            // Summoning sickness (unless Quickdraw)
            if (attacker.hasSummoningSickness && !QuickdrawBehaviour.HasQuickdraw(attacker))
                return false;

            // Pacifism effects (can't attack)
            if (attacker.cantAttack) return false;

            return true;
        }

        /// <summary>
        /// Get all legal attackers for a player
        /// </summary>
        public static List<CardData> GetLegalAttackers(int playerId, GameState gameState)
        {
            var battlefield = gameState.ZoneManager.GetBattlefield(playerId);
            return battlefield.Where(c => CanAttack(c, gameState)).ToList();
        }

        /// <summary>
        /// Calculate combat damage assignment for trample (Overrun)
        /// </summary>
        public static (int blockerDamage, int playerDamage) AssignDamage(
            CardData attacker, 
            CardData blocker, 
            int totalDamage,
            int damageAlreadyAssignedToBlocker = 0)
        {
            if (!OverrunBehaviour.HasOverrun(attacker) || blocker == null)
                return (totalDamage, 0);

            int blockerToughness = blocker.health;
            int blockerDamageMarked = blocker.damageMarked ?? 0;
            int lethalDamage = blockerToughness - blockerDamageMarked - damageAlreadyAssignedToBlocker;
            if (lethalDamage < 0) lethalDamage = 0;

            int damageToBlocker = Math.Min(totalDamage, lethalDamage);
            int damageToPlayer = totalDamage - damageToBlocker;

            return (damageToBlocker, damageToPlayer);
        }

        /// <summary>
        /// Check if attacker has first strike / double strike (Swiftstrike)
        /// </summary>
        public static bool HasFirstStrike(CardData card) => SwiftstrikeBehaviour.HasSwiftstrike(card);

        /// <summary>
        /// Check if blocker has first strike / double strike
        /// </summary>
        public static bool BlockerHasFirstStrike(CardData card) => SwiftstrikeBehaviour.HasSwiftstrike(card);
    }
}