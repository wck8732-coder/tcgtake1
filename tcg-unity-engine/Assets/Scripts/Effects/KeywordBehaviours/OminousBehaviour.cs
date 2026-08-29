// KeywordBehaviours/OminousBehaviour.cs
// Ominous: When this creature deals combat damage, it flips at end of turn
// Transform/flip mechanic unique to this game
using TCG.Data;

namespace TCG.Effects.KeywordBehaviours
{
    public static class OminousBehaviour
    {
        public const string KeywordName = "Ominous";
        public const KeywordFlags Flag = KeywordFlags.Ominous;

        public static bool HasOminous(CardData card) => card.HasKeyword(Flag);

        /// <summary>
        /// Mark that this creature dealt combat damage this turn
        /// </summary>
        public static void OnCombatDamageDealt(CardData card)
        {
            if (HasOminous(card))
            {
                card.dealtCombatDamageThisTurn = true;
            }
        }

        /// <summary>
        /// Check if this creature should flip at end of turn
        /// </summary>
        public static bool ShouldFlipAtEndOfTurn(CardData card)
        {
            return HasOminous(card) && card.dealtCombatDamageThisTurn && !card.isFlipped;
        }

        /// <summary>
        /// Perform the flip - swap stats/abilities to flipped side
        /// </summary>
        public static void Flip(CardData card, GameState gameState)
        {
            if (!HasOminous(card) || card.isFlipped) return;

            card.isFlipped = true;
            card.dealtCombatDamageThisTurn = false;

            // Swap to flipped side stats/abilities
            // The flipped data would come from the card's flip-side definition
            // For now, apply a simple transformation
            ApplyFlippedSide(card);
        }

        /// <summary>
        /// Unflip at cleanup (if not permanent)
        /// </summary>
        public static void Unflip(CardData card)
        {
            if (!HasOminous(card) || !card.isFlipped) return;

            card.isFlipped = false;
            // Revert to front side
            RevertToFrontSide(card);
        }

        private static void ApplyFlippedSide(CardData card)
        {
            // In a full implementation, the card data would have:
            // - flippedAttack, flippedHealth
            // - flippedAbilities, flippedKeywords
            // For now, apply a standard flip bonus
            card.attack += 2;
            card.health += 2;
            // Add menace/Intimidate on flip
            card.keywordFlags |= KeywordFlags.Intimidate;
        }

        private static void RevertToFrontSide(CardData card)
        {
            // Revert the changes
            card.attack -= 2;
            card.health -= 2;
            card.keywordFlags &= ~KeywordFlags.Intimidate;
        }

        public static string GetDisplayText() => "Ominous (When this deals combat damage, it transforms at end of turn.)";
    }
}